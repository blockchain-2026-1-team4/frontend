import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { OrganizerApplication } from "../../types/api";

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "거절됨",
};

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value?: string) {
  if (!value) {
    return "-";
  }
  return value.slice(0, 8);
}

function getHttpStatus(cause: unknown) {
  if (!cause || typeof cause !== "object") {
    return undefined;
  }

  return (cause as { response?: { status?: number } }).response?.status;
}

function buildError(cause: unknown) {
  if (getHttpStatus(cause) === 403) {
    return "관리자 권한이 필요합니다. ADMIN 역할이 포함된 계정으로 다시 로그인하세요.";
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return "주최자 신청 목록을 불러오지 못했습니다.";
}

export function OrganizerApprovalsPage() {
  const [items, setItems] = useState<OrganizerApplication[]>([]);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("PENDING");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await backendApi.getOrganizerApplications({
        status: filterStatus !== "ALL" ? filterStatus : undefined,
        size: 50,
      });
      setItems(data.items ?? []);
    } catch (cause) {
      setItems([]);
      setError(buildError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filterStatus]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return items;
    }

    return items.filter((item) =>
      [item.businessName, item.contactEmail, item.description, item.userId, item.id, item.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [items, query]);

  const pendingCount = items.filter((item) => item.status === "PENDING").length;
  const approvedCount = items.filter((item) => item.status === "APPROVED").length;
  const rejectedCount = items.filter((item) => item.status === "REJECTED").length;

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    setReviewingId(id);
    setError(null);
    try {
      await backendApi.reviewOrganizerApplication(id, decision);
      setMessage(decision === "APPROVED" ? "주최자 신청을 승인했습니다." : "주최자 신청을 거절했습니다.");
      await load();
    } catch (cause) {
      setError(buildError(cause));
    } finally {
      setReviewingId(null);
      window.setTimeout(() => setMessage(null), 3000);
    }
  }

  const filterTabs: { label: string; value: StatusFilter }[] = [
    { label: "전체", value: "ALL" },
    { label: "승인 대기", value: "PENDING" },
    { label: "승인됨", value: "APPROVED" },
    { label: "거절됨", value: "REJECTED" },
  ];

  return (
    <>
      <style>{`
        .oa-page { display: grid; gap: 1rem; }
        .oa-header { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 1.15rem 1.3rem; box-shadow: var(--shadow); display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .oa-title .eyebrow { margin: 0; }
        .oa-title h2 { margin: 0.15rem 0 0; font-size: 1.45rem; }
        .oa-metrics { display: grid; grid-template-columns: repeat(3, minmax(110px, 1fr)); gap: 0.6rem; min-width: 360px; }
        .oa-metric { border: 1px solid var(--border); border-radius: 14px; background: #f8fafc; padding: 0.7rem 0.85rem; }
        .oa-metric span { display: block; color: var(--txt-sub); font-size: 0.78rem; font-weight: 700; }
        .oa-metric strong { display: block; margin-top: 0.25rem; font-size: 1.25rem; }
        .oa-alert { background: #fff5f5; border: 1px solid #ffcdd2; color: #c62828; border-radius: 12px; padding: 0.75rem 1rem; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
        .oa-alert .button { border-color: #ffcdd2; background: #fff; color: #c62828; padding: 0.35rem 0.65rem; }
        .oa-toast { background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; border-radius: 12px; padding: 0.75rem 1rem; font-weight: 700; }
        .oa-shell { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
        .oa-toolbar { padding: 1rem 1.1rem; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, #fff, #f7f9fc); display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; flex-wrap: wrap; }
        .oa-toolbar h3 { margin: 0; font-size: 1rem; }
        .oa-tabs { display: flex; gap: 0.35rem; flex-wrap: wrap; }
        .oa-tab { border: 1px solid var(--border); background: var(--panel-soft); color: var(--txt-sub); border-radius: 999px; padding: 0.34rem 0.78rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
        .oa-tab.active { background: #e8f1ff; border-color: #cfe0ff; color: var(--accent-2); }
        .oa-search { width: 260px; border: 1px solid var(--border-strong); border-radius: 10px; padding: 0.52rem 0.72rem; color: var(--txt-main); background: #fff; }
        .oa-table-wrap { overflow-x: auto; }
        .oa-table { width: 100%; min-width: 1040px; border-collapse: collapse; font-size: 0.88rem; }
        .oa-table th { padding: 0.75rem 0.95rem; text-align: left; color: var(--txt-sub); font-size: 0.76rem; font-weight: 800; background: #f8fafc; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .oa-table td { padding: 0.9rem 0.95rem; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--txt-main); }
        .oa-business strong { display: block; font-size: 0.95rem; }
        .oa-business p { margin: 0.18rem 0 0; color: var(--txt-sub); font-size: 0.8rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .oa-mono { font-family: "Courier New", monospace; color: var(--txt-sub); white-space: nowrap; }
        .oa-email { color: var(--accent-2); font-weight: 700; white-space: nowrap; }
        .oa-badge { display: inline-flex; border-radius: 999px; padding: 0.3rem 0.66rem; font-size: 0.74rem; font-weight: 800; white-space: nowrap; }
        .oa-badge.pending { background: #e8f1ff; color: var(--accent-2); }
        .oa-badge.approved { background: #e8f5e9; color: #2e7d32; }
        .oa-badge.rejected { background: #fce4ec; color: #c62828; }
        .oa-actions { display: flex; gap: 0.42rem; flex-wrap: wrap; }
        .oa-action { border: 1px solid var(--border); background: var(--panel-soft); color: var(--txt-main); border-radius: 9px; padding: 0.42rem 0.72rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; }
        .oa-action.primary { border-color: var(--accent-2); background: var(--accent-2); color: #fff; }
        .oa-action.danger { border-color: #ffcdd2; background: #fff5f5; color: #c62828; }
        .oa-action:disabled { opacity: 0.5; cursor: not-allowed; }
        .oa-empty { text-align: center; padding: 3rem 1rem; color: var(--txt-sub); }
        @media (max-width: 900px) {
          .oa-metrics { min-width: 0; width: 100%; grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .oa-search { width: 100%; }
        }
      `}</style>

      <section className="oa-page">
        <header className="oa-header">
          <div className="oa-title">
            <p className="eyebrow">주최자 승인</p>
            <h2>주최자 신청 심사</h2>
          </div>
          <div className="oa-metrics">
            <article className="oa-metric">
              <span>승인 대기</span>
              <strong>{pendingCount}</strong>
            </article>
            <article className="oa-metric">
              <span>승인됨</span>
              <strong>{approvedCount}</strong>
            </article>
            <article className="oa-metric">
              <span>거절됨</span>
              <strong>{rejectedCount}</strong>
            </article>
          </div>
        </header>

        {error ? (
          <div className="oa-alert">
            <span>{error}</span>
            <Link className="button" to="/login">
              다시 로그인
            </Link>
          </div>
        ) : null}
        {message ? <div className="oa-toast">{message}</div> : null}

        <div className="oa-shell">
          <div className="oa-toolbar">
            <h3>신청 목록</h3>
            <div className="oa-tabs">
              {filterTabs.map((tab) => (
                <button
                  key={tab.value}
                  className={`oa-tab${filterStatus === tab.value ? " active" : ""}`}
                  onClick={() => setFilterStatus(tab.value)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              className="oa-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="상호명, 이메일, 사용자 ID 검색"
            />
          </div>

          <div className="oa-table-wrap">
            <table className="oa-table">
              <thead>
                <tr>
                  <th>신청 ID</th>
                  <th>상호 / 설명</th>
                  <th>연락 이메일</th>
                  <th>신청자</th>
                  <th>상태</th>
                  <th>신청일</th>
                  <th>검토자</th>
                  <th>검토일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="oa-empty" colSpan={9}>
                      불러오는 중...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td className="oa-empty" colSpan={9}>
                      조건에 맞는 주최자 신청이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const status = item.status ?? "PENDING";
                    const isPending = status === "PENDING";
                    const isBusy = reviewingId === item.id;

                    return (
                      <tr key={item.id ?? JSON.stringify(item)}>
                        <td className="oa-mono">#{shortId(item.id)}</td>
                        <td className="oa-business">
                          <strong>{item.businessName || "상호명 없음"}</strong>
                          <p title={item.description}>{item.description || "설명 없음"}</p>
                        </td>
                        <td className="oa-email">{item.contactEmail || "-"}</td>
                        <td className="oa-mono">#{shortId(item.userId)}</td>
                        <td>
                          <span className={`oa-badge ${status.toLowerCase()}`}>
                            {STATUS_LABEL[status] ?? status}
                          </span>
                        </td>
                        <td>{formatDate(item.createdAt)}</td>
                        <td className="oa-mono">#{shortId(item.reviewedBy)}</td>
                        <td>{formatDate(item.reviewedAt)}</td>
                        <td>
                          <div className="oa-actions">
                            <button
                              className="oa-action primary"
                              disabled={!item.id || !isPending || isBusy}
                              onClick={() => item.id && void review(item.id, "APPROVED")}
                              type="button"
                            >
                              승인
                            </button>
                            <button
                              className="oa-action danger"
                              disabled={!item.id || !isPending || isBusy}
                              onClick={() => item.id && void review(item.id, "REJECTED")}
                              type="button"
                            >
                              거절
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
