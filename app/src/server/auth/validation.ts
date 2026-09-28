import { ServiceError } from "@/server/errors/service-error";

export function validateDisplayName(value: unknown, label = "表示名") {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
    throw new ServiceError(`${label}は1〜100文字で入力してください。`, 400);
  }

  return value.trim();
}

export function validateEmail(value: unknown) {
  if (
    typeof value !== "string" ||
    value.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  ) {
    throw new ServiceError("有効なメールアドレスを入力してください。", 400);
  }

  return value.trim().toLowerCase();
}

export function validateNewPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 12 || value.length > 256 || !value.trim()) {
    throw new ServiceError("パスワードは12〜256文字で入力してください。", 400);
  }

  return value;
}
