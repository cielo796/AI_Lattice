import { createHmac, timingSafeEqual } from "node:crypto";
import { ServiceError } from "@/server/errors/service-error";

export const WEBHOOK_MAX_BYTES = 65536;
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

export function webhookEnvelope(request: Request, now = Date.now()) {
  const timestamp = request.headers.get("x-ai-lattice-timestamp") ?? "";
  const deliveryId = request.headers.get("x-ai-lattice-delivery") ?? "";
  const signature = request.headers.get("x-ai-lattice-signature") ?? "";
  const seconds = Number(timestamp);
  if (!/^\d{1,12}$/.test(timestamp) || !Number.isSafeInteger(seconds) || Math.abs(now / 1000 - seconds) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS || !/^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(deliveryId) || !/^v1=[a-f0-9]{64}$/i.test(signature)) throw new ServiceError("Webhook署名情報が不正または期限切れです。", 401);
  return { timestamp, deliveryId, signature };
}

export function webhookSignature(secret: string, timestamp: string, deliveryId: string, body: Uint8Array) {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}\n${deliveryId}\n`).update(body).digest("hex")}`;
}

export function verifyWebhookSignature(secret: string, envelope: ReturnType<typeof webhookEnvelope>, body: Uint8Array) {
  const provided = Buffer.from(envelope.signature.slice(3), "hex");
  const expected = Buffer.from(webhookSignature(secret, envelope.timestamp, envelope.deliveryId, body).slice(3), "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new ServiceError("Webhook署名を確認できません。", 401);
}

export async function readWebhookBody(request: Request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "") || ![null, "identity"].includes(request.headers.get("content-encoding"))) throw new ServiceError("Webhookは非圧縮のUTF-8 JSONで送信してください。", 415);
  const length = request.headers.get("content-length");
  if (length !== null && !/^\d+$/.test(length)) throw new ServiceError("Content-Lengthが不正です。", 400);
  if (length !== null && Number(length) > WEBHOOK_MAX_BYTES) throw new ServiceError("Webhookの本文は64KiB以内にしてください。", 413);
  if (!request.body) throw new ServiceError("Webhook本文が必要です。", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > WEBHOOK_MAX_BYTES) { await reader.cancel(); throw new ServiceError("Webhookの本文は64KiB以内にしてください。", 413); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, bytes);
}

export function parseWebhookPayload(body: Uint8Array) {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
  catch { throw new ServiceError("Webhook本文は有効なUTF-8 JSONで指定してください。", 400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ServiceError("Webhook本文はJSONオブジェクトで指定してください。", 400);
  const payload = value as Record<string, unknown>;
  if (Object.keys(payload).some((key) => !["recordId", "tableId", "tableCode", "data", "status"].includes(key))) throw new ServiceError("Webhook本文に未対応の項目があります。", 400);
  for (const key of ["recordId", "tableId", "tableCode", "status"]) if (payload[key] !== undefined && (typeof payload[key] !== "string" || !(payload[key] as string).trim() || (payload[key] as string).length > 128 || /[\u0000-\u001f\u007f]/.test(payload[key] as string))) throw new ServiceError(`${key}が不正です。`, 400);
  if (payload.recordId !== undefined) {
    if (payload.data !== undefined || payload.status !== undefined) throw new ServiceError("既存レコードの解決と新規データの指定は併用できません。", 400);
  } else if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) throw new ServiceError("新規レコードのdataを指定してください。", 400);
  return payload as { recordId?: string; tableId?: string; tableCode?: string; data?: Record<string, unknown>; status?: string };
}
