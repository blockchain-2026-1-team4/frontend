import { backendApi } from "./backend";
import { clearAccessToken } from "./auth";

export async function requireAdminPath() {
  const me = await backendApi.getMe();
  const roles = new Set(me.roles ?? []);

  if (roles.has("ADMIN")) {
    return "/admin";
  }

  clearAccessToken();
  throw new Error("ADMIN 계정이 필요합니다. 관리자 계정으로 로그인하세요.");
}
