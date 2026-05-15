import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backend";
import type { EventSummary } from "../../types/api";

export function MyEventsPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);

  useEffect(() => {
    backendApi.getMyEvents().then((data) => setEvents(data.items ?? []));
  }, []);

  return (
    <section className="panel">
      <h2>My Events</h2>
      <div className="card-grid">
        {events.map((event) => (
          <article className="event-card" key={event.id}>
            <h3>{event.title}</h3>
            <p>{event.venue}</p>
            <p>{event.status}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
