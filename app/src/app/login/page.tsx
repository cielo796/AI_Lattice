import { LoginForm } from "@/components/auth/LoginForm";
import { DatabaseSetupNotice } from "@/components/shared/DatabaseSetupNotice";
import { isDatabaseSetupError, toDatabaseSetupErrorBody } from "@/server/db/setup-errors";
import { isDemoAutoSeedEnabled } from "@/server/demo/seed-policy";
import { getSetupStatus } from "@/server/setup/service";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let setupAvailable: boolean;
  try {
    const setup = await getSetupStatus();
    setupAvailable = setup.available;
  } catch (error) {
    if (isDatabaseSetupError(error)) {
      return <DatabaseSetupNotice {...toDatabaseSetupErrorBody(error)} />;
    }
    throw error;
  }
  return <LoginForm demoEnabled={isDemoAutoSeedEnabled()} setupAvailable={setupAvailable} />;
}
