import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { backendApi } from "../../lib/backend";

export function EventDetailPage() {
  const { eventId = "" } = useParams();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!eventId) {
      return;
    }
    backendApi.getEvent(eventId).then((result) => setEvent(result as Record<string, unknown>));
  }, [eventId]);

  async function onPrimaryPurchase() {
    const ticketIdValue = prompt("ticketId");
    if (!ticketIdValue) {
      return;
    }
    await backendApi.purchasePrimary(ticketIdValue);
    setMessage("Primary purchase request sent.");
  }

  return (
    <section className="panel">
      <h2>Event Detail</h2>
      <pre className="code">{JSON.stringify(event, null, 2)}</pre>
      <div className="action-row">
        <button className="button primary" onClick={() => void onPrimaryPurchase()}>
          Buy ticket (off-chain API)
        </button>
      </div>
      {message ? <p>{message}</p> : null}
    </section>
  );
}
