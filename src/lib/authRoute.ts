import { backendApi } from "./backend";
import { clearAccessToken } from "./auth";

export async function requireAdminPath() {
  const me = await backendApi.getMe();
  const roles = new Set(me.roles ?? []);

  if (roles.has("ADMIN")) {
    return "/admin";
  }

  clearAccessToken();
  throw new Error("ADMIN account is required. Please log in with an administrator account.");
}
