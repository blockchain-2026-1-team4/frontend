import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { EventSummary } from "../../types/api";

export function UserHomePage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [keyword, setKeyword] = useState("");

  async function loadEvents(search?: string) {
    const data = await backendApi.getEvents({ keyword: search });
    setEvents(data.items ?? []);
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  return (
    <section className="panel">
      <h2>User Main</h2>
      <div className="row">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search events"
        />
        <button className="button" onClick={() => void loadEvents(keyword)}>
          Search
        </button>
      </div>
      <div className="card-grid">
        {events.map((event) => (
          <Link key={event.id} className="event-card" to={`/user/events/${event.id}`}>
            <h3>{event.title}</h3>
            <p>{event.venue}</p>
            <p>{new Date(event.eventDateTime).toLocaleString()}</p>
            <p>{event.status}</p>
          </Link>
        ))}
      </div>
      <div className="action-row">
        <Link className="button" to="/user/resale">
          Resale market
        </Link>
        <Link className="button" to="/user/me">
          My page
        </Link>
      </div>
    </section>
  );
}
