import { Link, Outlet } from "react-router-dom";

const links = [
  { to: "/user", label: "User" },
  { to: "/organizer", label: "Organizer" },
  { to: "/admin", label: "Admin" },
];

export function Layout() {
  return (
    <div>
      <nav className="nav-grid">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="nav-chip">
            {item.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
