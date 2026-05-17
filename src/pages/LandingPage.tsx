import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">KYUNGHEE BLOCKCHAIN 2026</p>
        <h1>On-chain trust, off-chain speed for ticketing.</h1>
        <p className="lead">
          User and organizer flows live in the app shell, while the admin workspace stays on the web.
        </p>
      </div>
      <div className="action-row">
        <Link className="button primary" to="/login">
          Login
        </Link>
        <Link className="button" to="/register">
          Sign up
        </Link>
        <Link className="button" to="/organizer">
          Organizer app
        </Link>
        <Link className="button" to="/admin">
          Admin web
        </Link>
      </div>
    </section>
  );
}
