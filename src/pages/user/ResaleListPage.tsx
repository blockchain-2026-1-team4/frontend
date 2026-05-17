import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { ResaleListing } from "../../types/api";

export function ResaleListPage() {
  const [items, setItems] = useState<ResaleListing[]>([]);

  useEffect(() => {
    backendApi.getResaleListings().then((data) => setItems(data.items ?? []));
  }, []);

  return (
    <section className="panel">
      <h2>리셀 목록</h2>
      <div className="card-grid">
        {items.map((item) => (
          <Link key={item.listingId} className="event-card" to={`/app/resale/${item.listingId}`}>
            <h3>{item.eventName}</h3>
            <p>좌석: {item.seatInfo}</p>
            <p>가격: {item.price}</p>
            <p>상태: {item.status}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
