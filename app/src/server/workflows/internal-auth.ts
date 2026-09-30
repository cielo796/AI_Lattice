import { timingSafeEqual } from "node:crypto";
import { ServiceError } from "@/server/errors/service-error";

export function authorizeWorkflowCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32 || secret.startsWith("replace-with")) throw new ServiceError("32文字以上のランダムなCRON_SECRETを設定してください。", 503);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new ServiceError("Unauthorized", 401);
}
