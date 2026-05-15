import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { backendApi } from "../../lib/backend";

export function ResaleDetailPage() {
  const { listingId = "" } = useParams();
  const [item, setItem] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!listingId) {
      return;
    }
    backendApi
      .getResaleListing(listingId)
      .then((result) => setItem(result as unknown as Record<string, unknown>));
  }, [listingId]);

  async function onPurchase() {
    if (!listingId) {
      return;
    }
    await backendApi.purchaseResale(listingId);
    setMessage("Resale purchase request sent.");
  }

  return (
    <section className="panel">
      <h2>Resale Detail</h2>
      <pre className="code">{JSON.stringify(item, null, 2)}</pre>
      <button className="button primary" onClick={() => void onPurchase()}>
        Purchase resale
      </button>
      {message ? <p>{message}</p> : null}
    </section>
  );
}
