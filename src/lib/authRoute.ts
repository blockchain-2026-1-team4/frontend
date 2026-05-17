import { backendApi } from "./backend";

export async function resolveRolePath(fallback = "/app") {
  const me = await backendApi.getMe();
  const roles = new Set(me.roles ?? []);

  if (roles.has("ADMIN")) {
    return "/admin";
  }

  if (roles.has("ORGANIZER")) {
    return "/organizer";
  }

  return fallback;
}