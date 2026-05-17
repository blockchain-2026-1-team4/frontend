import { Link, Outlet } from "react-router-dom";

const links = [
  { to: "/app", label: "User app" },
  { to: "/organizer", label: "Organizer app" },
  { to: "/admin", label: "Admin web" },
];

export function Layout() {
  return (
    <div className="app-shell">
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
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
