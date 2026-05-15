import { Link } from "react-router-dom";

export function OrganizerDashboardPage() {
  return (
    <section className="panel">
      <h2>Organizer Dashboard</h2>
      <p>Create events, issue tickets, and monitor check-ins from one flow.</p>
      <div className="action-row">
        <Link className="button primary" to="/organizer/events/new">
          New event
        </Link>
        <Link className="button" to="/organizer/events">
          My events
        </Link>
      </div>
    </section>
  );
}
