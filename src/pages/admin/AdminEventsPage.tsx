import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backend";
import type { EventDetail } from "../../types/api";

type FilterStatus = "ALL" | "ACTIVE" | "CANCELLED" | "ENDED";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "진행중",
  CANCELLED: "취소됨",
  ENDED: "종료됨",
  PENDING: "대기중",
  FLAGGED: "플래그",
};

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "badge-active",
  CANCELLED: "badge-cancelled",
  ENDED: "badge-ended",
  PENDING: "badge-pending",
  FLAGGED: "badge-flagged",
};

export function AdminEventsPage() {
  const [items, setItems] = useState<EventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await backendApi.getAdminEvents({
        query: query || undefined,
        status: filterStatus !== "ALL" ? filterStatus : undefined,
      });
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filterStatus]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void load();
  }

  async function handleFlag(eventId: string, currentlyFlagged: boolean) {
    setFlaggingId(eventId);
    try {
      if (currentlyFlagged) {
        await backendApi.unflagAdminEvent(eventId);
        setActionMessage("플래그를 해제했습니다.");
      } else {
        await backendApi.flagAdminEvent(eventId);
        setActionMessage("이벤트에 플래그를 설정했습니다.");
      }
      await load();
    } finally {
      setFlaggingId(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  }

  const filterTabs: { label: string; value: FilterStatus }[] = [
    { label: "전체", value: "ALL" },
    { label: "진행중", value: "ACTIVE" },
    { label: "종료됨", value: "ENDED" },
    { label: "취소됨", value: "CANCELLED" },
  ];

  return (
    <>
      <style>{`
        .events-page { display: grid; gap: 1rem; }

        .events-header-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 1.2rem 1.4rem;
          box-shadow: var(--shadow);
        }

        .events-toprow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .events-title-group { display: grid; gap: 0.2rem; }
        .events-title-group .eyebrow { margin: 0; }
        .events-title-group h2 { margin: 0; font-size: 1.4rem; }

        .search-form {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .search-input {
          border-radius: 10px;
          border: 1px solid var(--border-strong);
          padding: 0.5rem 0.75rem;
          font-size: 0.9rem;
          width: 220px;
          color: var(--txt-main);
          background: #fff;
        }

        .search-input::placeholder { color: #8a97a8; }

        .search-btn {
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--txt-main);
          border-radius: 10px;
          padding: 0.5rem 0.85rem;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .search-btn:hover { background: var(--bg-1); }

        .filter-tabs {
          display: flex;
          gap: 0.4rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }

        .filter-tab {
          border: 1px solid var(--border);
          background: var(--panel-soft);
          color: var(--txt-sub);
          border-radius: 999px;
          padding: 0.38rem 0.9rem;
          font-size: 0.83rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .filter-tab:hover { background: var(--bg-1); color: var(--txt-main); }

        .filter-tab.active {
          background: linear-gradient(135deg, #eaf2ff, #f0f6ff);
          border-color: #cfe0ff;
          color: var(--accent-2);
        }

        .toast {
          background: #e8f5e9;
          border: 1px solid #a5d6a7;
          color: #2e7d32;
          border-radius: 10px;
          padding: 0.6rem 1rem;
          font-size: 0.88rem;
          font-weight: 600;
          margin-top: 0.5rem;
        }

        .events-table-shell {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 20px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .events-table-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, #fff, #f7f9fc);
        }

        .events-table-head h3 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
        }

        .count-badge {
          background: #e8f1ff;
          color: var(--accent-2);
          border-radius: 999px;
          padding: 0.28rem 0.7rem;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .events-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
        }

        .events-table thead tr {
          background: #f8fafc;
          border-bottom: 1px solid var(--border);
        }

        .events-table th {
          padding: 0.7rem 1rem;
          text-align: left;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--txt-sub);
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .events-table td {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          color: var(--txt-main);
        }

        .events-table tbody tr:last-child td { border-bottom: 0; }

        .events-table tbody tr:hover { background: #fafcff; }

        .event-id-cell {
          font-family: "Courier New", monospace;
          font-size: 0.78rem;
          color: var(--txt-sub);
          white-space: nowrap;
        }

        .event-name-cell { font-weight: 600; }
        .event-name-cell .venue {
          font-weight: 400;
          font-size: 0.8rem;
          color: var(--txt-sub);
          margin-top: 0.15rem;
        }

        .organizer-cell { color: var(--txt-sub); font-size: 0.85rem; }

        .status-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0.28rem 0.65rem;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }

        .badge-active   { background: #e8f5e9; color: #2e7d32; }
        .badge-ended    { background: #f3f3f3; color: #555; }
        .badge-cancelled{ background: #fff3e0; color: #e65100; }
        .badge-pending  { background: #e8f1ff; color: var(--accent-2); }
        .badge-flagged  { background: #fce4ec; color: #c62828; }

        .flag-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ef5350;
          margin-right: 5px;
          vertical-align: middle;
        }

        .actions-cell { white-space: nowrap; }

        .flag-btn {
          border: 1px solid #ffcdd2;
          background: #fff5f5;
          color: #c62828;
          border-radius: 8px;
          padding: 0.38rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }

        .flag-btn:hover { background: #ffebee; border-color: #ef9a9a; }
        .flag-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .unflag-btn {
          border: 1px solid var(--border);
          background: var(--panel-soft);
          color: var(--txt-sub);
          border-radius: 8px;
          padding: 0.38rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }

        .unflag-btn:hover { background: var(--bg-1); }
        .unflag-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .tickets-cell { text-align: right; font-variant-numeric: tabular-nums; }
        .tickets-sold { font-weight: 700; }
        .tickets-total { color: var(--txt-sub); font-size: 0.82rem; }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: var(--txt-sub);
        }

        .loading-row td {
          text-align: center;
          padding: 3rem;
          color: var(--txt-sub);
        }

        @media (max-width: 768px) {
          .events-toprow { flex-direction: column; }
          .search-input { width: 100%; }
          .events-table th:nth-child(1),
          .events-table td:nth-child(1) { display: none; }
          .events-table th:nth-child(4),
          .events-table td:nth-child(4) { display: none; }
        }
      `}</style>

      <div className="events-page">
        {/* Header Card */}
        <div className="events-header-card">
          <div className="events-toprow">
            <div className="events-title-group">
              <p className="eyebrow">이벤트 관리</p>
              <h2>이벤트 감독</h2>
            </div>
            <form className="search-form" onSubmit={handleSearch}>
              <input
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이벤트명 또는 주최자 검색"
              />
              <button className="search-btn" type="submit">검색</button>
            </form>
          </div>

          <div className="filter-tabs">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                className={`filter-tab${filterStatus === tab.value ? " active" : ""}`}
                onClick={() => setFilterStatus(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {actionMessage && <div className="toast">{actionMessage}</div>}
        </div>

        {/* Table */}
        <div className="events-table-shell">
          <div className="events-table-head">
            <h3>전체 이벤트 목록</h3>
            <span className="count-badge">{items.length}건</span>
          </div>

          {items.length === 0 && !loading ? (
            <div className="empty-state">
              <p>조건에 맞는 이벤트가 없습니다.</p>
            </div>
          ) : (
            <table className="events-table">
              <thead>
                <tr>
                  <th>이벤트 ID</th>
                  <th>이벤트명 / 장소</th>
                  <th>주최자</th>
                  <th>판매 현황</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="loading-row">
                    <td colSpan={6}>불러오는 중...</td>
                  </tr>
                ) : (
                  items.map((event) => {
                    const isFlagged = event.status === "FLAGGED" || (event as any).flagged === true;
                    const status = isFlagged ? "FLAGGED" : (event.status ?? "ACTIVE");

                    return (
                      <tr key={event.id}>
                        <td className="event-id-cell">
                          #{String(event.id).slice(0, 8)}
                        </td>
                        <td className="event-name-cell">
                          <div>{event.title ?? event.name}</div>
                          <div className="venue">{event.venue ?? event.venueDetail ?? "-"}</div>
                        </td>
                        <td className="organizer-cell">
                          {(event as any).organizerName ??
                           (event as any).organizer ??
                           (event as any).organizerId?.slice(0, 10) ??
                           "-"}
                        </td>
                        <td className="tickets-cell">
                          <span className="tickets-sold">{event.soldTicketCount ?? "-"}</span>
                          <span className="tickets-total"> / {event.totalTicketCount ?? "-"}</span>
                        </td>
                        <td>
                          <span className={`status-badge ${STATUS_CLASS[status] ?? "badge-ended"}`}>
                            {isFlagged && <span className="flag-dot" />}
                            {STATUS_LABEL[status] ?? status}
                          </span>
                        </td>
                        <td className="actions-cell">
                          {isFlagged ? (
                            <button
                              className="unflag-btn"
                              disabled={flaggingId === event.id}
                              onClick={() => void handleFlag(event.id, true)}
                            >
                              {flaggingId === event.id ? "처리중..." : "플래그 해제"}
                            </button>
                          ) : (
                            <button
                              className="flag-btn"
                              disabled={flaggingId === event.id}
                              onClick={() => void handleFlag(event.id, false)}
                            >
                              {flaggingId === event.id ? "처리중..." : "플래그"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
