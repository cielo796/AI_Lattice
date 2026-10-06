ALTER TABLE "tenants"
  ADD COLUMN "default_theme" TEXT NOT NULL DEFAULT 'navy',
  ADD COLUMN "allow_user_theme" BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "tenants_default_theme_check" CHECK ("default_theme" IN ('navy', 'white'));

ALTER TABLE "users"
  ADD COLUMN "display_theme" TEXT,
  ADD CONSTRAINT "users_display_theme_check" CHECK ("display_theme" IN ('navy', 'white', 'dark', 'system'));
