import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">KYUNGHEE BLOCKCHAIN 2026</p>
        <h1>On-chain trust, off-chain speed for ticketing.</h1>
        <p className="lead">
          Backend API and TrustTicket contract are integrated through one frontend shell.
        </p>
      </div>
      <div className="action-row">
        <Link className="button primary" to="/login">
          Login
        </Link>
        <Link className="button" to="/register">
          Sign up
        </Link>
      </div>
    </section>
  );
}
