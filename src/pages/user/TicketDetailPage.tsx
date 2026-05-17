import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { backendApi } from "../../lib/backend";

export function TicketDetailPage() {
  const { ticketId = "0" } = useParams();
  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null);
  const [resalePrice, setResalePrice] = useState("0");
  const [message, setMessage] = useState("");

  useEffect(() => {
    backendApi.getTicket(ticketId).then((data) => setTicket(data as unknown as Record<string, unknown>));
  }, [ticketId]);

  async function onResaleSubmit() {
    await backendApi.createResale(ticketId, resalePrice);
    setMessage("Resale listing created.");
  }

  return (
    <section className="panel">
      <h2>Ticket Detail</h2>
      <pre className="code">{JSON.stringify(ticket, null, 2)}</pre>
      <div className="row">
        <input value={resalePrice} onChange={(e) => setResalePrice(e.target.value)} />
        <button className="button" onClick={() => void onResaleSubmit()}>
          Create resale listing
        </button>
      </div>
      {message ? <p>{message}</p> : null}
    </section>
  );
}
