import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearAccessToken } from "../lib/auth";

const adminLinks = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/organizer-approvals", label: "Organizer Approvals" },
  { to: "/admin/events", label: "Event Supervision" },
  { to: "/admin/users", label: "User Management" },
  { to: "/admin/disputes", label: "Disputes / Transactions" },
  { to: "/admin/blockchain", label: "Blockchain Logs" },
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
            TRUST TICKET ADMIN
          </Link>
          <div className="sidebar-title">Menu</div>
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
              <p className="eyebrow">Admin Console</p>
              <h1>Trust Ticket Operations</h1>
            </div>
            <button className="button" onClick={handleLogout} type="button">
              Log out
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
          TRUST TICKET ADMIN
        </Link>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
