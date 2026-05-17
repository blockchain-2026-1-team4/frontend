import { Link, Outlet } from "react-router-dom";

export function OrganizerAppLayout() {
  return (
    <div className="mobile-app-shell">
      <main className="mobile-content">
        <Outlet />
      </main>

      <nav className="mobile-bottom-nav">
        <Link to="/organizer" className="mobile-tab">
          대시보드
        </Link>
        <Link to="/organizer/events" className="mobile-tab">
          내이벤트
        </Link>
        <Link to="/organizer/events/new" className="mobile-tab">
          등록
        </Link>
        <Link to="/organizer/me" className="mobile-tab">
          내정보
        </Link>
      </nav>
    </div>
  );
}