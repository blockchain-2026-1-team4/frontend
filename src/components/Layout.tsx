import { Link, Outlet, useLocation } from "react-router-dom";

const links = [
  { to: "/app", label: "사용자 앱" },
  { to: "/organizer", label: "주최자 앱" },
  { to: "/admin", label: "관리자 웹" },
];

export function Layout() {
  const { pathname } = useLocation();
  const hideShell = pathname.startsWith("/app") || pathname.startsWith("/organizer");

  return (
    <div className="app-shell">
      {!hideShell ? (
        <>
          <header className="topbar">
            <Link className="brand" to="/">
              TRUST TICKET
            </Link>
          </header>
          <nav className="nav-grid">
            {links.map((item) => (
              <Link key={item.to} to={item.to} className="nav-chip">
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      ) : null}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
