import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearAccessToken } from "../lib/auth";

const adminLinks = [
  { to: "/admin", label: "관리자 대시보드", end: true },
  { to: "/admin/organizer-approvals", label: "주최자 승인" },
  { to: "/admin/events", label: "이벤트 감독" },
  { to: "/admin/users", label: "사용자 관리" },
  { to: "/admin/disputes", label: "분쟁/거래 센터" },
  { to: "/admin/blockchain", label: "블록체인 로그" },
];

export function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = pathname.startsWith("/admin");

  function handleLogout() {
    clearAccessToken();
    navigate("/login", { replace: true });
  }

  if (isAdminRoute) {
    return (
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="brand brand-admin" to="/admin">
            TRUST TICKET
          </Link>
          <div className="sidebar-title">메뉴</div>
          <nav className="sidebar-nav">
            {adminLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div>
              <p className="eyebrow">관리자 웹 포털</p>
              <h1>관리자 대시보드</h1>
            </div>
            <button className="button" onClick={handleLogout} type="button">
              로그아웃
            </button>
          </header>

          <main className="content admin-content">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          TRUST TICKET
        </Link>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
