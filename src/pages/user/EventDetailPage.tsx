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
    const ticketIdValue = prompt("티켓 ID를 입력하세요");
    if (!ticketIdValue) {
      return;
    }
    await backendApi.purchasePrimary(ticketIdValue);
    setMessage("1차 구매 요청을 전송했습니다.");
  }

  return (
    <section className="panel">
      <h2>이벤트 상세</h2>
      <pre className="code">{JSON.stringify(event, null, 2)}</pre>
      <div className="action-row">
        <button className="button primary" onClick={() => void onPrimaryPurchase()}>
          티켓 구매
        </button>
      </div>
      {message ? <p>{message}</p> : null}
    </section>
  );
}
