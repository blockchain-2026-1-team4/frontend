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
      <h2>Resale Listings</h2>
      <div className="card-grid">
        {items.map((item) => (
          <Link key={item.listingId} className="event-card" to={`/user/resale/${item.listingId}`}>
            <h3>{item.eventName}</h3>
            <p>Seat: {item.seatInfo}</p>
            <p>Price: {item.price}</p>
            <p>Status: {item.status}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
