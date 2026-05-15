import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backend";

type ApplicationItem = {
  id?: string;
  userId?: string;
  status?: string;
  [key: string]: unknown;
};

export function OrganizerApprovalsPage() {
  const [items, setItems] = useState<ApplicationItem[]>([]);

  async function load() {
    const data = await backendApi.getOrganizerApplications();
    setItems(data.items as ApplicationItem[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    await backendApi.reviewOrganizerApplication(id, decision);
    await load();
  }

  return (
    <section className="panel">
      <h2>Organizer Approvals</h2>
      <div className="card-grid">
        {items.map((item) => (
          <article className="event-card" key={item.id ?? JSON.stringify(item)}>
            <pre className="code">{JSON.stringify(item, null, 2)}</pre>
            {item.id ? (
              <div className="action-row">
                <button className="button primary" onClick={() => void review(item.id as string, "APPROVED")}>
                  Approve
                </button>
                <button className="button" onClick={() => void review(item.id as string, "REJECTED")}>
                  Reject
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
