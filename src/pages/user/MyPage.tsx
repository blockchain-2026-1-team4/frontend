import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { TicketDetail } from "../../types/api";

export function MyPage() {
  const [tickets, setTickets] = useState<TicketDetail[]>([]);

  useEffect(() => {
    backendApi.getMyTickets().then((data) => setTickets(data));
  }, []);

  return (
    <section className="panel">
      <h2>My Page</h2>
      <div className="card-grid">
        {tickets.map((ticket) => (
          <Link
            key={ticket.ticketId}
            className="event-card"
            to={`/app/tickets/${ticket.ticketId}`}
          >
            <h3>{ticket.eventName}</h3>
            <p>{ticket.seatInfo}</p>
            <p>{ticket.status}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
