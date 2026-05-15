import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backend";

export function DisputesPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    backendApi.getDisputes().then((data) => setItems(data.items));
  }, []);

  return (
    <section className="panel">
      <h2>Disputes & Transactions</h2>
      <div className="card-grid">
        {items.map((item, idx) => (
          <article key={idx} className="event-card">
            <pre className="code">{JSON.stringify(item, null, 2)}</pre>
          </article>
        ))}
      </div>
    </section>
  );
}
