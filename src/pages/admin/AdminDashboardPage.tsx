import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    backendApi.getAdminDashboard().then((data) => setDashboard(data));
  }, []);

  return (
    <section className="panel">
      <h2>Admin Dashboard</h2>
      <div className="action-row">
        <Link className="button" to="/admin/organizer-approvals">
          Organizer approvals
        </Link>
        <Link className="button" to="/admin/disputes">
          Disputes
        </Link>
      </div>
      <pre className="code">{JSON.stringify(dashboard, null, 2)}</pre>
    </section>
  );
}
