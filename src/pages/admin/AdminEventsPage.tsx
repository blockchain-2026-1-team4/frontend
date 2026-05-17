import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminPagination } from "../../components/AdminPagination";
import { backendApi } from "../../lib/backend";
import type { EventDetail } from "../../types/api";

type FilterStatus = "ALL" | "ACTIVE" | "INACTIVE" | "CANCELED";
const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "진행중",
  INACTIVE: "비활성",
  CANCELED: "취소됨",
  FLAGGED: "플래그",
};

function getHttpStatus(cause: unknown) {
  if (!cause || typeof cause !== "object") {
    return undefined;
  }

  return (cause as { response?: { status?: number } }).response?.status;
}

function buildError(cause: unknown) {
  const status = getHttpStatus(cause);
  if (status === 401 || status === 403) {
    return "관리자 로그인이 필요합니다. 관리자 계정으로 다시 로그인하세요.";
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return "이벤트 목록을 불러오지 못했습니다.";
}

function shortId(value?: string) {
  if (!value) {
    return "-";
  }
  return value.slice(0, 8);
}

export function AdminEventsPage() {
  const [items, setItems] = useState<EventDetail[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState<number | undefined>();
  const [totalPages, setTotalPages] = useState<number | undefined>();
  const [hasNext, setHasNext] = useState(false);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const me = await backendApi.getMe();
      if (!me.roles?.includes("ADMIN")) {
        setItems([]);
        setHasLoaded(false);
        setError("관리자 로그인이 필요합니다. 관리자 계정으로 다시 로그인하세요.");
        return;
      }

      const data = await backendApi.getAdminEvents({
        page,
        size: PAGE_SIZE,
        query: query || undefined,
        status: filterStatus !== "ALL" ? filterStatus : undefined,
      });
      setItems(data.items ?? []);
      setTotalElements(data.totalElements);
      setTotalPages(data.totalPages);
      setHasNext(data.hasNext ?? false);
      setHasLoaded(true);
    } catch (cause) {
      setItems([]);
      setTotalElements(undefined);
      setTotalPages(undefined);
      setHasNext(false);
      setHasLoaded(false);
      setError(buildError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filterStatus, page]);

  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return items;
    }
    return items.filter((event) =>
      [event.title, event.name, event.venue, event.venueDetail, event.organizerName, event.organizerId, event.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [items, query]);

  async function handleFlag(eventId: string, currentlyFlagged: boolean) {
    const message = currentlyFlagged ? "이벤트 플래그를 해제하시겠습니까?" : "이 이벤트에 플래그를 설정하시겠습니까?";
    if (!window.confirm(message)) {
      return;
    }

    setFlaggingId(eventId);
    setError(null);
    try {
      if (currentlyFlagged) {
        await backendApi.unflagAdminEvent(eventId);
        setActionMessage("이벤트 플래그를 해제했습니다.");
      } else {
        await backendApi.flagAdminEvent(eventId);
        setActionMessage("이벤트에 플래그를 설정했습니다.");
      }
      await load();
    } catch (cause) {
      setError(buildError(cause));
    } finally {
      setFlaggingId(null);
      window.setTimeout(() => setActionMessage(null), 3000);
    }
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setPage(0);
    void load();
  }

  const filterTabs: { label: string; value: FilterStatus }[] = [
    { label: "전체", value: "ALL" },
    { label: "진행중", value: "ACTIVE" },
    { label: "비활성", value: "INACTIVE" },
    { label: "취소됨", value: "CANCELED" },
  ];

  const showEmpty = hasLoaded && visibleItems.length === 0 && !loading;

  return (
    <>
      <style>{`
        .ae-page { display: grid; gap: 1rem; }
        .ae-header { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 1.2rem 1.4rem; box-shadow: var(--shadow); }
        .ae-toprow { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .ae-title .eyebrow { margin: 0; }
        .ae-title h2 { margin: 0.15rem 0 0; font-size: 1.4rem; }
        .ae-search { display: flex; gap: 0.5rem; align-items: center; }
        .ae-search input { border-radius: 10px; border: 1px solid var(--border-strong); padding: 0.5rem 0.75rem; font-size: 0.9rem; width: 240px; color: var(--txt-main); background: #fff; }
        .ae-search button { border: 1px solid var(--border); background: var(--panel); color: var(--txt-main); border-radius: 10px; padding: 0.5rem 0.85rem; cursor: pointer; font-size: 0.9rem; font-weight: 700; }
        .ae-tabs { display: flex; gap: 0.4rem; margin-top: 1rem; flex-wrap: wrap; }
        .ae-tab { border: 1px solid var(--border); background: var(--panel-soft); color: var(--txt-sub); border-radius: 999px; padding: 0.38rem 0.9rem; font-size: 0.83rem; font-weight: 700; cursor: pointer; }
        .ae-tab.active { background: #e8f1ff; border-color: #cfe0ff; color: var(--accent-2); }
        .ae-toast { background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; border-radius: 10px; padding: 0.65rem 1rem; font-size: 0.88rem; font-weight: 700; margin-top: 0.75rem; }
        .ae-error { background: #fff5f5; border: 1px solid #ffcdd2; color: #c62828; border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.88rem; font-weight: 700; margin-top: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
        .ae-error .button { border-color: #ffcdd2; background: #fff; color: #c62828; padding: 0.35rem 0.65rem; }
        .ae-shell { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
        .ae-table-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, #fff, #f7f9fc); }
        .ae-table-head h3 { margin: 0; font-size: 0.95rem; font-weight: 800; }
        .ae-count { background: #e8f1ff; color: var(--accent-2); border-radius: 999px; padding: 0.28rem 0.7rem; font-size: 0.78rem; font-weight: 800; }
        .ae-table-wrap { overflow-x: auto; }
        .ae-table { width: 100%; min-width: 920px; border-collapse: collapse; font-size: 0.88rem; }
        .ae-table th { padding: 0.72rem 1rem; text-align: left; font-size: 0.78rem; font-weight: 800; color: var(--txt-sub); background: #f8fafc; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .ae-table td { padding: 0.88rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--txt-main); }
        .ae-id { font-family: "Courier New", monospace; font-size: 0.78rem; color: var(--txt-sub); white-space: nowrap; }
        .ae-name strong { display: block; }
        .ae-name span { display: block; margin-top: 0.15rem; color: var(--txt-sub); font-size: 0.8rem; }
        .ae-status { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.28rem 0.65rem; font-size: 0.75rem; font-weight: 800; white-space: nowrap; }
        .ae-status.active { background: #e8f5e9; color: #2e7d32; }
        .ae-status.inactive { background: #f3f3f3; color: #555; }
        .ae-status.canceled { background: #fff3e0; color: #e65100; }
        .ae-status.flagged { background: #fce4ec; color: #c62828; }
        .ae-dot { width: 7px; height: 7px; border-radius: 50%; background: #ef5350; margin-right: 5px; }
        .ae-tickets { text-align: right; font-variant-numeric: tabular-nums; }
        .ae-tickets span { color: var(--txt-sub); font-size: 0.82rem; }
        .ae-action { border: 1px solid #ffcdd2; background: #fff5f5; color: #c62828; border-radius: 8px; padding: 0.4rem 0.72rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; }
        .ae-action.neutral { border-color: var(--border); background: var(--panel-soft); color: var(--txt-sub); }
        .ae-action:disabled { opacity: 0.5; cursor: not-allowed; }
        .ae-empty { text-align: center; padding: 3rem 1rem; color: var(--txt-sub); }
      `}</style>

      <div className="ae-page">
        <div className="ae-header">
          <div className="ae-toprow">
            <div className="ae-title">
              <p className="eyebrow">이벤트 관리</p>
              <h2>이벤트 감독</h2>
            </div>
            <form className="ae-search" onSubmit={handleSearch}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이벤트명 또는 주최자 검색" />
              <button type="submit">검색</button>
            </form>
          </div>

          <div className="ae-tabs">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                className={`ae-tab${filterStatus === tab.value ? " active" : ""}`}
                onClick={() => {
                  setPage(0);
                  setFilterStatus(tab.value);
                }}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {actionMessage ? <div className="ae-toast">{actionMessage}</div> : null}
          {error ? (
            <div className="ae-error">
              <span>{error}</span>
              <Link className="button" to="/login">다시 로그인</Link>
            </div>
          ) : null}
        </div>

        <div className="ae-shell">
          <div className="ae-table-head">
            <h3>전체 이벤트 목록</h3>
            <span className="ae-count">{hasLoaded ? visibleItems.length : "-"}건</span>
          </div>

          {showEmpty ? (
            <div className="ae-empty">조건에 맞는 이벤트가 없습니다.</div>
          ) : (
            <div className="ae-table-wrap">
              <table className="ae-table">
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
                    <tr>
                      <td className="ae-empty" colSpan={6}>불러오는 중...</td>
                    </tr>
                  ) : !hasLoaded ? (
                    <tr>
                      <td className="ae-empty" colSpan={6}>이벤트 목록을 불러오지 않았습니다.</td>
                    </tr>
                  ) : (
                    visibleItems.map((event) => {
                      const isFlagged = event.flagged === true || event.status === "FLAGGED";
                      const status = isFlagged ? "FLAGGED" : event.status ?? "ACTIVE";
                      return (
                        <tr key={event.id}>
                          <td className="ae-id">#{shortId(event.id)}</td>
                          <td className="ae-name">
                            <strong>{event.title ?? event.name ?? "-"}</strong>
                            <span>{event.venue ?? event.venueDetail ?? "-"}</span>
                          </td>
                          <td>{event.organizerName ?? shortId(event.organizerId)}</td>
                          <td className="ae-tickets">
                            <strong>{event.soldTicketCount ?? "-"}</strong>
                            <span> / {event.totalTicketCount ?? "-"}</span>
                          </td>
                          <td>
                            <span className={`ae-status ${status.toLowerCase()}`}>
                              {isFlagged ? <span className="ae-dot" /> : null}
                              {STATUS_LABEL[status] ?? status}
                            </span>
                          </td>
                          <td>
                            {isFlagged ? (
                              <button
                                className="ae-action neutral"
                                disabled={flaggingId === event.id}
                                onClick={() => void handleFlag(event.id, true)}
                                type="button"
                              >
                                {flaggingId === event.id ? "처리중..." : "플래그 해제"}
                              </button>
                            ) : (
                              <button
                                className="ae-action"
                                disabled={flaggingId === event.id}
                                onClick={() => void handleFlag(event.id, false)}
                                type="button"
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
            </div>
          )}
          <AdminPagination
            page={page}
            size={PAGE_SIZE}
            totalElements={totalElements}
            totalPages={totalPages}
            hasNext={hasNext}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      </div>
    </>
  );
}
