import { Link, Outlet } from "react-router-dom";

export function UserAppLayout() {
  return (
    <div className="mobile-app-shell">
      <main className="mobile-content">
        <Outlet />
      </main>

      <nav className="mobile-bottom-nav">
        <Link to="/app/home" className="mobile-tab">
          홈
        </Link>
        <Link to="/app/events" className="mobile-tab">
          이벤트
        </Link>
        <Link to="/app/resale" className="mobile-tab">
          리셀
        </Link>
        <Link to="/app/me" className="mobile-tab">
          내정보
        </Link>
      </nav>
    </div>
  );
}