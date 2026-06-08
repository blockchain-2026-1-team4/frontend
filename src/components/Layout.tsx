import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearAccessToken } from "../lib/auth";

const adminLinks = [
  { to: "/admin", label: "대시보드", icon: "ti-layout-dashboard", end: true },
  { to: "/admin/organizer-approvals", label: "주최자 승인", icon: "ti-user-check" },
  { to: "/admin/events", label: "이벤트 검수", icon: "ti-calendar-search" },
  { to: "/admin/users", label: "회원 관리", icon: "ti-users" },
  { to: "/admin/disputes", label: "신고·거래 관리", icon: "ti-message-report" },
  { to: "/admin/blockchain", label: "거래 기록", icon: "ti-database" },
];

const adminPageTitles = [
  { path: "/admin/organizer-approvals", title: "주최자 승인" },
  { path: "/admin/events", title: "이벤트 검수" },
  { path: "/admin/users", title: "회원 관리" },
  { path: "/admin/disputes", title: "신고·거래 관리" },
  { path: "/admin/blockchain", title: "거래 기록" },
];

export function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = pathname.startsWith("/admin");
  const adminTitle = adminPageTitles.find((item) => pathname.startsWith(item.path))?.title ?? "대시보드";

  function handleLogout() {
    clearAccessToken();
    navigate("/login", { replace: true });
  }

  if (!isAdminRoute) {
    return <Outlet />;
  }

  return (
    <div className="admin-console-app">
      <aside className="sidebar">
        <Link className="brand" to="/admin">
          <div className="logo">TT</div>
          <span>TRUST TICKET</span>
        </Link>
        <div className="menu-label">메뉴</div>
        <nav className="nav">
          {adminLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              <i className={`ti ${item.icon}`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="top">
          <div>
            <div className="eyebrow">관리자 워크스페이스</div>
            <h1>{adminTitle}</h1>
          </div>
          <button className="logout" onClick={handleLogout} type="button">
            로그아웃
          </button>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
