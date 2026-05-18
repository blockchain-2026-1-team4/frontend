import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Trust Ticket Admin</p>
        <h1>Blockchain ticketing admin console</h1>
        <p className="lead">
          On-chain trust, off-chain speed for ticketing operations. Use this web console for
          administrator dashboard, organizer approvals, event supervision, user management,
          dispute review, resale transaction review, and blockchain transaction logs.
        </p>
      </div>
      <div className="action-row">
        <Link className="button primary" to="/login">
          Admin login
        </Link>
        <Link className="button" to="/admin">
          Open admin dashboard
        </Link>
      </div>
    </section>
  );
}
