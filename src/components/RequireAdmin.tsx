import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { backendApi } from "../lib/backend";
import { clearAccessToken } from "../lib/auth";

type AdminGuardState = "checking" | "allowed" | "blocked";

export function RequireAdmin() {
  const [state, setState] = useState<AdminGuardState>("checking");

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      try {
        const me = await backendApi.getMe();
        const roles = new Set(me.roles ?? []);

        if (!active) {
          return;
        }

        if (roles.has("ADMIN")) {
          setState("allowed");
          return;
        }

        clearAccessToken();
        window.alert("ADMIN 계정이 아닙니다. 관리자 계정으로 로그인해주세요.");
        setState("blocked");
      } catch {
        if (active) {
          clearAccessToken();
          setState("blocked");
        }
      }
    }

    void checkAdmin();

    return () => {
      active = false;
    };
  }, []);

  if (state === "checking") {
    return (
      <section className="panel">
        <h2>관리자 권한 확인 중</h2>
        <p className="lead">관리자 계정 정보를 확인하고 있습니다.</p>
      </section>
    );
  }

  if (state === "blocked") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
