import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/server/auth/service";

export default async function RootPage() {
  const user = await getAuthenticatedUser();
  redirect(user ? "/home" : "/login");
}
