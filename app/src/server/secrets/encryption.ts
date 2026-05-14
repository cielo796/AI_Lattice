import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { AppsServiceError } from "@/server/apps/service";

const ENCRYPTION_VERSION = "v1";
const IV_LENGTH = 12;

function getEncryptionKeyMaterial() {
  const configuredKey = process.env.SECRET_ENCRYPTION_KEY?.trim();

  if (configuredKey) {
    return configuredKey;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return databaseUrl;
  }

  throw new AppsServiceError(
    "SECRET_ENCRYPTION_KEY または DATABASE_URL が設定されていません",
    503
  );
}

function getEncryptionKey() {
  return createHash("sha256").update(getEncryptionKeyMaterial()).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value: string) {
  const [version, rawIv, rawAuthTag, rawEncrypted] = value.split(":");

  if (
    version !== ENCRYPTION_VERSION ||
    !rawIv ||
    !rawAuthTag ||
    !rawEncrypted
  ) {
    throw new AppsServiceError("保存済みシークレットの形式が不正です", 503);
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(rawIv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(rawAuthTag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(rawEncrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppsServiceError("保存済みシークレットを復号できません", 503);
  }
}
