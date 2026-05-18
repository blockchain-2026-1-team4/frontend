import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { BlockchainTransactionRecord } from "../../types/api";

type StatusFilter = "ALL" | "SIMULATED" | "SUBMITTED" | "FAILED";

const STATUS_LABEL: Record<string, string> = {
  SIMULATED: "시뮬레이션 기록",
  SUBMITTED: "체인 제출됨",
  FAILED: "실패",
};

const ACTION_LABEL: Record<string, string> = {
  addOrganizer: "주최자 온체인 등록",
  addValidator: "전역 체크인 검증자 등록",
  addEventValidator: "이벤트 체크인 검증자 등록",
  createEvent: "이벤트 생성",
  setEventStatus: "이벤트 활성 상태 변경",
  mintTicket: "티켓 발행",
  purchaseTicket: "1차 티켓 구매",
  listTicket: "리셀 등록",
  purchaseResaleTicket: "리셀 구매",
  cancelListing: "리셀 등록 취소",
  useTicket: "입장 처리",
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
  return "블록체인 로그를 불러오지 못했습니다.";
}

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

function shortText(value?: string, length = 12) {
  if (!value) {
    return "-";
  }
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

export function AdminBlockchainLogPage() {
  const [items, setItems] = useState<BlockchainTransactionRecord[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
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

      const data = await backendApi.getBlockchainTransactions({ size: 80 });
      setItems(data);
      setHasLoaded(true);
    } catch (cause) {
      setItems([]);
      setHasLoaded(false);
      setError(buildError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = status === "ALL" || item.status === status;
      if (!matchesStatus) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [item.id, item.action, item.transactionHash, item.txHash, item.contractAddress, item.status, item.errorMessage]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [items, query, status]);

  const failedCount = items.filter((item) => item.status === "FAILED").length;
  const submittedCount = items.filter((item) => item.status === "SUBMITTED").length;
  const simulatedCount = items.filter((item) => item.status === "SIMULATED").length;

  function onSearch(event: FormEvent) {
    event.preventDefault();
  }

  const filterTabs: { label: string; value: StatusFilter }[] = [
    { label: "전체", value: "ALL" },
    { label: "시뮬레이션 기록", value: "SIMULATED" },
    { label: "체인 제출됨", value: "SUBMITTED" },
    { label: "실패", value: "FAILED" },
  ];

  return (
    <>
      <style>{`
        .bc-page { display: grid; gap: 1rem; }
        .bc-header { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 1.15rem 1.3rem; box-shadow: var(--shadow); display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .bc-title .eyebrow { margin: 0; }
        .bc-title h2 { margin: 0.15rem 0 0; font-size: 1.45rem; }
        .bc-title p.desc { margin: 0.45rem 0 0; color: var(--txt-sub); font-size: 0.9rem; line-height: 1.55; }
        .bc-metrics { display: grid; grid-template-columns: repeat(3, minmax(120px, 1fr)); gap: 0.6rem; min-width: 380px; }
        .bc-metric { border: 1px solid var(--border); border-radius: 14px; background: #f8fafc; padding: 0.7rem 0.85rem; }
        .bc-metric span { display: block; color: var(--txt-sub); font-size: 0.78rem; font-weight: 800; }
        .bc-metric strong { display: block; margin-top: 0.25rem; font-size: 1.25rem; }
        .bc-error { background: #fff5f5; border: 1px solid #ffcdd2; color: #c62828; border-radius: 12px; padding: 0.75rem 1rem; font-weight: 800; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .bc-error .button { border-color: #ffcdd2; background: #fff; color: #c62828; padding: 0.35rem 0.65rem; }
        .bc-note { border: 1px solid #dbeafe; background: #f8fbff; color: var(--txt-sub); border-radius: 12px; padding: 0.72rem 0.9rem; font-size: 0.84rem; line-height: 1.55; }
        .bc-note strong { color: var(--txt-main); }
        .bc-note code { color: var(--txt-main); font-weight: 800; }
        .bc-shell { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
        .bc-toolbar { padding: 1rem 1.1rem; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, #fff, #f7f9fc); display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; flex-wrap: wrap; }
        .bc-toolbar h3 { margin: 0; font-size: 1rem; }
        .bc-tabs { display: flex; gap: 0.35rem; flex-wrap: wrap; }
        .bc-tab { border: 1px solid var(--border); background: var(--panel-soft); color: var(--txt-sub); border-radius: 999px; padding: 0.34rem 0.78rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; }
        .bc-tab.active { background: #e8f1ff; border-color: #cfe0ff; color: var(--accent-2); }
        .bc-search { display: flex; gap: 0.45rem; }
        .bc-search input { width: 280px; border: 1px solid var(--border-strong); border-radius: 10px; padding: 0.52rem 0.72rem; color: var(--txt-main); background: #fff; }
        .bc-search button { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 0.5rem 0.8rem; font-weight: 800; cursor: pointer; }
        .bc-table-wrap { overflow-x: auto; }
        .bc-table { width: 100%; min-width: 980px; border-collapse: collapse; font-size: 0.88rem; }
        .bc-table th { padding: 0.75rem 0.95rem; text-align: left; color: var(--txt-sub); font-size: 0.76rem; font-weight: 800; background: #f8fafc; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .bc-table td { padding: 0.9rem 0.95rem; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--txt-main); }
        .bc-mono { font-family: "Courier New", monospace; color: var(--txt-sub); white-space: nowrap; }
        .bc-action { font-weight: 800; }
        .bc-badge { display: inline-flex; border-radius: 999px; padding: 0.3rem 0.66rem; font-size: 0.74rem; font-weight: 800; white-space: nowrap; }
        .bc-badge.simulated { background: #e8f1ff; color: var(--accent-2); }
        .bc-badge.submitted { background: #e8f5e9; color: #2e7d32; }
        .bc-badge.failed { background: #fce4ec; color: #c62828; }
        .bc-error-msg { max-width: 360px; color: #c62828; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bc-empty { text-align: center; padding: 3rem 1rem; color: var(--txt-sub); }
        @media (max-width: 900px) {
          .bc-metrics { min-width: 0; width: 100%; grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .bc-search, .bc-search input { width: 100%; }
        }
      `}</style>

      <section className="bc-page">
        <header className="bc-header">
          <div className="bc-title">
            <p className="eyebrow">블록체인 로그</p>
            <h2>트랜잭션 모니터링</h2>
            <p className="desc">백엔드가 기록한 온체인 제출 또는 시뮬레이션 액션을 최근 순서로 확인합니다.</p>
          </div>
          <div className="bc-metrics">
            <article className="bc-metric">
              <span>시뮬레이션 기록</span>
              <strong>{simulatedCount}</strong>
            </article>
            <article className="bc-metric">
              <span>체인 제출됨</span>
              <strong>{submittedCount}</strong>
            </article>
            <article className="bc-metric">
              <span>실패</span>
              <strong>{failedCount}</strong>
            </article>
          </div>
        </header>

        <div className="bc-note">
          <strong>SIMULATED</strong>는 백엔드가 블록체인 비활성 모드에서 실제 전송 대신 기록한 상태입니다. <strong>SUBMITTED</strong>는 Web3j 게이트웨이가 컨트랙트 트랜잭션을 제출하고 해시를 받은 상태이며, 현재 화면은 컨펌 수까지 추적하지 않습니다.
          기록 액션은 <code>createEvent</code>, <code>mintTicket</code>, <code>purchaseTicket</code>, <code>listTicket</code>, <code>purchaseResaleTicket</code>, <code>cancelListing</code>, <code>useTicket</code>, 검증자/주최자 등록 계열입니다.
        </div>

        {error ? (
          <div className="bc-error">
            <span>{error}</span>
            <Link className="button" to="/login">다시 로그인</Link>
          </div>
        ) : null}

        <div className="bc-shell">
          <div className="bc-toolbar">
            <h3>최근 트랜잭션</h3>
            <div className="bc-tabs">
              {filterTabs.map((tab) => (
                <button
                  key={tab.value}
                  className={`bc-tab${status === tab.value ? " active" : ""}`}
                  onClick={() => setStatus(tab.value)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <form className="bc-search" onSubmit={onSearch}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="액션, 해시, 컨트랙트 검색" />
              <button type="submit">검색</button>
            </form>
          </div>

          <div className="bc-table-wrap">
            <table className="bc-table">
              <thead>
                <tr>
                  <th>로그 ID</th>
                  <th>액션</th>
                  <th>트랜잭션 해시</th>
                  <th>컨트랙트</th>
                  <th>상태</th>
                  <th>오류</th>
                  <th>생성일</th>
                  <th>수정일</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="bc-empty" colSpan={8}>불러오는 중...</td>
                  </tr>
                ) : !hasLoaded ? (
                  <tr>
                    <td className="bc-empty" colSpan={8}>블록체인 로그를 불러오지 않았습니다.</td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td className="bc-empty" colSpan={8}>조건에 맞는 로그가 없습니다.</td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const txHash = item.transactionHash ?? item.txHash;
                    const itemStatus = item.status ?? "SIMULATED";
                    return (
                      <tr key={item.id ?? `${item.action}-${item.createdAt}`}>
                        <td className="bc-mono">#{shortText(item.id, 8)}</td>
                        <td className="bc-action">{item.action ? ACTION_LABEL[item.action] ?? item.action : "-"}</td>
                        <td className="bc-mono" title={txHash}>{shortText(txHash, 18)}</td>
                        <td className="bc-mono" title={item.contractAddress}>{shortText(item.contractAddress, 14)}</td>
                        <td>
                          <span className={`bc-badge ${itemStatus.toLowerCase()}`}>
                            {STATUS_LABEL[itemStatus] ?? itemStatus}
                          </span>
                        </td>
                        <td>
                          <div className="bc-error-msg" title={item.errorMessage}>
                            {item.errorMessage ?? "-"}
                          </div>
                        </td>
                        <td>{formatDate(item.createdAt)}</td>
                        <td>{formatDate(item.updatedAt)}</td>
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
