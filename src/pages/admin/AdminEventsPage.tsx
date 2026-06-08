import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminPagination } from "../../components/AdminPagination";
import { backendApi } from "../../lib/backend";
import type { EventDetail } from "../../types/api";
import { buildAdminError, shortId } from "./adminUtils";

type FilterStatus = "ALL" | "PUBLISHED" | "INACTIVE" | "DRAFT" | "CANCELLED";
type FlaggedFilter = "ALL" | "FLAGGED" | "NORMAL";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "진행 중",
  INACTIVE: "비활성",
  DRAFT: "초안",
  CANCELLED: "취소됨",
  FLAGGED: "검수",
};

function statusClass(status?: string, flagged?: boolean) {
  if (flagged) return "orange";
  if (status === "PUBLISHED") return "green";
  if (status === "CANCELLED") return "red";
  return "";
}

function sortCanceledLast(events: EventDetail[]) {
  return [...events].sort((a, b) => {
    if (a.status === "CANCELLED" && b.status !== "CANCELLED") return 1;
    if (a.status !== "CANCELLED" && b.status === "CANCELLED") return -1;
    const aTime = new Date(a.eventAt ?? a.eventDateTime ?? "").getTime();
    const bTime = new Date(b.eventAt ?? b.eventDateTime ?? "").getTime();
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

export function AdminEventsPage() {
  const [items, setItems] = useState<EventDetail[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [flaggedFilter, setFlaggedFilter] = useState<FlaggedFilter>("ALL");
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState<number | undefined>();
  const [totalPages, setTotalPages] = useState<number | undefined>();
  const [hasNext, setHasNext] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const data = await backendApi.getAdminEvents({
        page,
        size: PAGE_SIZE,
        query: query.trim() || undefined,
        status: filterStatus !== "ALL" ? filterStatus : undefined,
        flagged: flaggedFilter === "ALL" ? undefined : flaggedFilter === "FLAGGED",
      });
      setItems(sortCanceledLast(data.items ?? []));
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
      setError(buildAdminError(cause, "이벤트 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filterStatus, flaggedFilter, page]);

  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = !keyword
      ? items
      : items.filter((event) =>
          [event.title, event.name, event.venue, event.venueDetail, event.organizerName, event.organizerId, event.id]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(keyword),
        );
    return sortCanceledLast(filtered);
  }, [items, query]);

  async function handleFlag(eventId: string, currentlyFlagged: boolean) {
    const confirmMessage = currentlyFlagged ? "이 이벤트의 검수 상태를 해제할까요?" : "이 이벤트를 검수 대상으로 지정할까요?";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setBusyId(eventId);
    setError(null);
    try {
      if (currentlyFlagged) {
        await backendApi.unflagAdminEvent(eventId);
        setActionMessage("이벤트 검수 상태를 해제했습니다.");
      } else {
        await backendApi.flagAdminEvent(eventId);
        setActionMessage("이벤트를 검수 대상으로 지정했습니다.");
      }
      await load();
    } catch (cause) {
      setError(buildAdminError(cause, "이벤트 검수 상태 변경에 실패했습니다."));
    } finally {
      setBusyId(null);
      window.setTimeout(() => setActionMessage(null), 3000);
    }
  }

  async function handleStatus(eventId: string, status: "PUBLISHED" | "CANCELLED") {
    const confirmMessage = status === "CANCELLED" ? "이 이벤트를 취소할까요?" : "이 이벤트를 다시 활성화할까요?";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setBusyId(eventId);
    setError(null);
    try {
      await backendApi.updateEventStatus(eventId, { status });
      setActionMessage(status === "CANCELLED" ? "이벤트를 취소했습니다." : "이벤트를 다시 활성화했습니다.");
      await load();
    } catch (cause) {
      setError(buildAdminError(cause, "이벤트 상태 변경에 실패했습니다."));
    } finally {
      setBusyId(null);
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
    { label: "진행 중", value: "PUBLISHED" },
    { label: "초안", value: "DRAFT" },
    { label: "비활성", value: "INACTIVE" },
    { label: "취소됨", value: "CANCELLED" },
  ];

  const flaggedTabs: { label: string; value: FlaggedFilter }[] = [
    { label: "전체", value: "ALL" },
    { label: "검수", value: "FLAGGED" },
    { label: "정상", value: "NORMAL" },
  ];

  const publishedCount = items.filter((item) => item.status === "PUBLISHED").length;
  const flaggedCount = items.filter((item) => item.flagged === true || item.status === "FLAGGED").length;

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">실무용 검수 테이블</div>
          <h2>이벤트 상태 검수</h2>
          <p>운영 상태와 검수 대상 여부를 확인합니다. 문제가 있는 이벤트는 검수 표시하거나 취소 처리합니다.</p>
        </div>
        <form className="section-right" onSubmit={handleSearch}>
          <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이벤트명 또는 주최자 검색" />
          <button className="btn" type="submit">검색</button>
        </form>
      </section>

      <section className="section">
        <div className="help">
          <strong>검수:</strong> 관리자가 추가 확인해야 하는 이벤트입니다. 판매 상태는 바뀌지 않습니다.
          <br />
          <strong>취소:</strong> 티켓 구매, 리셀, 체크인이 중단됩니다.
        </div>
        <div className="section-head">
          <div className="section-title">전체 이벤트 목록</div>
          <div className="section-right">
            <span className="chip green">진행 {publishedCount}</span>
            <span className="chip orange">검수 {flaggedCount}</span>
          </div>
        </div>
        <div className="section-head">
          <div className="section-right">
            {filterTabs.map((tab) => (
              <button
                className={`chip${filterStatus === tab.value ? " on" : ""}`}
                key={tab.value}
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
          <div className="section-right">
            {flaggedTabs.map((tab) => (
              <button
                className={`chip${flaggedFilter === tab.value ? " on" : ""}`}
                key={tab.value}
                onClick={() => {
                  setPage(0);
                  setFlaggedFilter(tab.value);
                }}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {actionMessage ? <div className="toast">{actionMessage}</div> : null}
        {error ? <div className="alert">{error}</div> : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>이벤트 번호</th>
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
                  <td className="empty" colSpan={6}>불러오는 중...</td>
                </tr>
              ) : !hasLoaded ? (
                <tr>
                  <td className="empty" colSpan={6}>이벤트 목록을 불러오지 못했습니다.</td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={6}>조건에 맞는 이벤트가 없습니다.</td>
                </tr>
              ) : (
                visibleItems.map((event) => {
                  const isFlagged = event.flagged === true || event.status === "FLAGGED";
                  const isCanceled = event.status === "CANCELLED";
                  const status = isFlagged ? "FLAGGED" : event.status ?? "PUBLISHED";
                  const label = event.adminCanceled && isCanceled ? "관리자 취소" : STATUS_LABEL[status] ?? status;

                  return (
                    <tr key={event.id}>
                      <td className="mono">#{shortId(event.id)}</td>
                      <td>
                        <div className="name">{event.title ?? event.name ?? "-"}</div>
                        <div className="sub">{event.venue ?? event.venueDetail ?? "장소 미정"}</div>
                      </td>
                      <td>{event.organizerName ?? shortId(event.organizerId)}</td>
                      <td>
                        <strong>{event.soldTicketCount ?? "-"}</strong>
                        <span className="sub"> / {event.totalTicketCount ?? "-"}</span>
                      </td>
                      <td><span className={`chip ${statusClass(event.status, isFlagged)}`}>{label}</span></td>
                      <td>
                        <div className="section-right">
                          <button className="btn out" disabled={busyId === event.id} onClick={() => void handleFlag(event.id, isFlagged)} type="button">
                            {isFlagged ? "검수 해제" : "검수"}
                          </button>
                          {isCanceled ? (
                            <button className="btn" disabled={busyId === event.id} onClick={() => void handleStatus(event.id, "PUBLISHED")} type="button">
                              재활성화
                            </button>
                          ) : (
                            <button className="btn red" disabled={busyId === event.id} onClick={() => void handleStatus(event.id, "CANCELLED")} type="button">
                              취소
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          page={page}
          size={PAGE_SIZE}
          totalElements={totalElements}
          totalPages={totalPages}
          hasNext={hasNext}
          loading={loading}
          onPageChange={setPage}
        />
      </section>
    </>
  );
}
