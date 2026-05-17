import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { DisputeRecord, ResaleTransactionRecord } from "../../types/api";

type DisputeStatusFilter = "ALL" | "OPEN" | "REVIEWING" | "RESOLVED" | "REJECTED";
type ResaleStatusFilter = "ALL" | "ACTIVE" | "SOLD" | "CANCELED";
type ReviewStatus = "REVIEWING" | "RESOLVED" | "REJECTED";

const DISPUTE_STATUS_LABEL: Record<string, string> = {
  OPEN: "접수",
  REVIEWING: "검토중",
  RESOLVED: "해결",
  REJECTED: "반려",
};

const RESALE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "판매중",
  SOLD: "거래완료",
  CANCELED: "취소",
};

const DISPUTE_TYPE_LABEL: Record<string, string> = {
  TICKET_NOT_DELIVERED: "티켓 미전달",
  PAYMENT_ISSUE: "결제 문제",
  FRAUD_SUSPECTED: "사기 의심",
  OTHER: "기타",
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

function formatId(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return String(value).slice(0, 8);
}

function formatWei(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  try {
    const wei = BigInt(String(value));
    const eth = Number(wei) / 1_000_000_000_000_000_000;
    if (!Number.isFinite(eth)) {
      return `${value} wei`;
    }
    return `${eth.toLocaleString("ko-KR", { maximumFractionDigits: 4 })} ETH`;
  } catch {
    return String(value);
  }
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
  return "데이터를 불러오지 못했습니다.";
}

export function AdminDisputeTransactionPage() {
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [transactions, setTransactions] = useState<ResaleTransactionRecord[]>([]);
  const [disputeStatus, setDisputeStatus] = useState<DisputeStatusFilter>("ALL");
  const [transactionStatus, setTransactionStatus] = useState<ResaleStatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [disputeData, transactionData] = await Promise.all([
        backendApi.getDisputes({
          status: disputeStatus !== "ALL" ? disputeStatus : undefined,
          size: 50,
        }),
        backendApi.getResaleTransactions({
          status: transactionStatus !== "ALL" ? transactionStatus : undefined,
          size: 50,
        }),
      ]);
      setDisputes(disputeData.items ?? []);
      setTransactions(transactionData.items ?? []);
    } catch (cause) {
      setError(buildError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [disputeStatus, transactionStatus]);

  const selectedDispute = useMemo(
    () => disputes.find((item) => item.id === selectedDisputeId) ?? disputes[0],
    [disputes, selectedDisputeId],
  );

  useEffect(() => {
    if (!selectedDispute) {
      setSelectedDisputeId(null);
      setReviewNote("");
      return;
    }

    setSelectedDisputeId(selectedDispute.id ?? null);
    setReviewNote(String(selectedDispute.resolutionNote ?? ""));
  }, [selectedDispute?.id]);

  const filteredTransactions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return transactions;
    }

    return transactions.filter((item) =>
      [item.listingId, item.id, item.ticketId, item.eventId, item.sellerId, item.buyerId, item.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [query, transactions]);

  const pendingCount = disputes.filter((item) => item.status === "OPEN" || item.status === "REVIEWING").length;
  const soldCount = transactions.filter((item) => item.status === "SOLD").length;
  const activeTransaction = selectedDispute?.resaleListingId
    ? transactions.find((item) => (item.listingId ?? item.id) === selectedDispute.resaleListingId)
    : undefined;

  async function review(status: ReviewStatus) {
    if (!selectedDispute?.id) {
      return;
    }

    setReviewingId(selectedDispute.id);
    setError(null);
    try {
      await backendApi.reviewDispute(selectedDispute.id, {
        status,
        resolutionNote: reviewNote.trim() || null,
      });
      setMessage(`분쟁 상태를 ${DISPUTE_STATUS_LABEL[status]}로 변경했습니다.`);
      await load();
    } catch (cause) {
      setError(buildError(cause));
    } finally {
      setReviewingId(null);
      window.setTimeout(() => setMessage(null), 3000);
    }
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
  }

  const disputeTabs: { label: string; value: DisputeStatusFilter }[] = [
    { label: "전체", value: "ALL" },
    { label: "접수", value: "OPEN" },
    { label: "검토중", value: "REVIEWING" },
    { label: "해결", value: "RESOLVED" },
    { label: "반려", value: "REJECTED" },
  ];

  const transactionTabs: { label: string; value: ResaleStatusFilter }[] = [
    { label: "전체", value: "ALL" },
    { label: "판매중", value: "ACTIVE" },
    { label: "거래완료", value: "SOLD" },
    { label: "취소", value: "CANCELED" },
  ];

  return (
    <>
      <style>{`
        .dt-page { display: grid; gap: 1rem; }
        .dt-header { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 1.15rem 1.3rem; box-shadow: var(--shadow); display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .dt-title h2 { margin: 0.15rem 0 0; font-size: 1.45rem; }
        .dt-title .eyebrow { margin: 0; }
        .dt-metrics { display: grid; grid-template-columns: repeat(3, minmax(120px, 1fr)); gap: 0.6rem; min-width: 380px; }
        .dt-metric { border: 1px solid var(--border); border-radius: 14px; padding: 0.7rem 0.85rem; background: #f8fafc; }
        .dt-metric span { display: block; color: var(--txt-sub); font-size: 0.78rem; font-weight: 700; }
        .dt-metric strong { display: block; margin-top: 0.25rem; font-size: 1.25rem; color: var(--txt-main); }
        .dt-alert { background: #fff5f5; border: 1px solid #ffcdd2; color: #c62828; border-radius: 12px; padding: 0.75rem 1rem; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
        .dt-alert .button { border-color: #ffcdd2; background: #fff; color: #c62828; padding: 0.35rem 0.65rem; }
        .dt-toast { background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; border-radius: 12px; padding: 0.75rem 1rem; font-weight: 700; }
        .dt-workspace { display: grid; grid-template-columns: minmax(360px, 0.95fr) minmax(420px, 1.15fr); gap: 1rem; align-items: start; }
        .dt-panel { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
        .dt-panel-head { padding: 1rem 1.1rem; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, #fff, #f7f9fc); display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; flex-wrap: wrap; }
        .dt-panel-head h3 { margin: 0; font-size: 1rem; }
        .dt-tabs { display: flex; gap: 0.35rem; flex-wrap: wrap; }
        .dt-tab { border: 1px solid var(--border); background: var(--panel-soft); color: var(--txt-sub); border-radius: 999px; padding: 0.32rem 0.72rem; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
        .dt-tab.active { background: #e8f1ff; border-color: #cfe0ff; color: var(--accent-2); }
        .dt-search { display: flex; gap: 0.45rem; }
        .dt-search input { width: 230px; border: 1px solid var(--border-strong); border-radius: 10px; padding: 0.5rem 0.7rem; }
        .dt-search button, .dt-review-actions button { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 0.48rem 0.78rem; font-weight: 700; cursor: pointer; }
        .dt-scroll { max-height: 560px; overflow: auto; }
        .dt-dispute-list { display: grid; }
        .dt-dispute-item { display: grid; grid-template-columns: 1fr auto; gap: 0.65rem; padding: 0.9rem 1.1rem; border-bottom: 1px solid var(--border); background: transparent; text-align: left; cursor: pointer; color: var(--txt-main); }
        .dt-dispute-item.active { background: #f3f8ff; }
        .dt-dispute-main strong { display: block; font-size: 0.95rem; }
        .dt-sub { margin: 0.2rem 0 0; color: var(--txt-sub); font-size: 0.8rem; }
        .dt-badge { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0.28rem 0.62rem; font-size: 0.74rem; font-weight: 800; white-space: nowrap; }
        .dt-badge.open, .dt-badge.reviewing, .dt-badge.active { background: #e8f1ff; color: var(--accent-2); }
        .dt-badge.resolved, .dt-badge.sold { background: #e8f5e9; color: #2e7d32; }
        .dt-badge.rejected, .dt-badge.canceled { background: #fce4ec; color: #c62828; }
        .dt-detail { padding: 1.1rem; display: grid; gap: 1rem; }
        .dt-detail-title { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
        .dt-detail-title h3 { margin: 0; font-size: 1.12rem; }
        .dt-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; }
        .dt-field { border: 1px solid var(--border); border-radius: 12px; padding: 0.7rem 0.8rem; background: #fbfcfe; min-width: 0; }
        .dt-field span { display: block; color: var(--txt-sub); font-size: 0.74rem; font-weight: 800; }
        .dt-field strong { display: block; margin-top: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dt-description { border: 1px solid var(--border); border-radius: 12px; padding: 0.85rem; color: var(--txt-main); background: #fff; line-height: 1.55; min-height: 92px; }
        .dt-review { display: grid; gap: 0.6rem; }
        .dt-review textarea { width: 100%; min-height: 92px; resize: vertical; border: 1px solid var(--border-strong); border-radius: 12px; padding: 0.75rem; font: inherit; box-sizing: border-box; }
        .dt-review-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .dt-review-actions .primary { background: var(--accent-2); border-color: var(--accent-2); color: #fff; }
        .dt-review-actions .danger { border-color: #ffcdd2; background: #fff5f5; color: #c62828; }
        .dt-transactions { width: 100%; border-collapse: collapse; min-width: 760px; }
        .dt-transactions th { text-align: left; color: var(--txt-sub); font-size: 0.76rem; padding: 0.7rem 0.9rem; background: #f8fafc; border-bottom: 1px solid var(--border); }
        .dt-transactions td { padding: 0.82rem 0.9rem; border-bottom: 1px solid var(--border); font-size: 0.86rem; vertical-align: middle; }
        .dt-mono { font-family: "Courier New", monospace; color: var(--txt-sub); }
        .dt-empty { padding: 3rem 1rem; text-align: center; color: var(--txt-sub); }
        @media (max-width: 980px) {
          .dt-workspace { grid-template-columns: 1fr; }
          .dt-metrics { min-width: 0; width: 100%; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
      `}</style>

      <div className="dt-page">
        <header className="dt-header">
          <div className="dt-title">
            <p className="eyebrow">분쟁/거래 센터</p>
            <h2>리셀 거래와 분쟁 처리</h2>
          </div>
          <div className="dt-metrics">
            <article className="dt-metric">
              <span>대기 분쟁</span>
              <strong>{pendingCount}</strong>
            </article>
            <article className="dt-metric">
              <span>거래 완료</span>
              <strong>{soldCount}</strong>
            </article>
            <article className="dt-metric">
              <span>조회 거래</span>
              <strong>{filteredTransactions.length}</strong>
            </article>
          </div>
        </header>

        {error ? (
          <div className="dt-alert">
            <span>{error}</span>
            <Link className="button" to="/login">
              다시 로그인
            </Link>
          </div>
        ) : null}
        {message ? <div className="dt-toast">{message}</div> : null}

        <div className="dt-workspace">
          <section className="dt-panel">
            <div className="dt-panel-head">
              <h3>분쟁 큐</h3>
              <div className="dt-tabs">
                {disputeTabs.map((tab) => (
                  <button
                    key={tab.value}
                    className={`dt-tab${disputeStatus === tab.value ? " active" : ""}`}
                    onClick={() => setDisputeStatus(tab.value)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="dt-scroll dt-dispute-list">
              {loading ? (
                <div className="dt-empty">불러오는 중...</div>
              ) : disputes.length === 0 ? (
                <div className="dt-empty">조건에 맞는 분쟁이 없습니다.</div>
              ) : (
                disputes.map((item) => {
                  const status = item.status ?? "OPEN";
                  return (
                    <button
                      key={item.id ?? JSON.stringify(item)}
                      className={`dt-dispute-item${selectedDispute?.id === item.id ? " active" : ""}`}
                      onClick={() => setSelectedDisputeId(item.id ?? null)}
                      type="button"
                    >
                      <div className="dt-dispute-main">
                        <strong>{DISPUTE_TYPE_LABEL[item.type ?? "OTHER"] ?? item.type ?? "분쟁"}</strong>
                        <p className="dt-sub">
                          #{formatId(item.id)} · 신고자 #{formatId(item.reporterId)} · {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <span className={`dt-badge ${status.toLowerCase()}`}>
                        {DISPUTE_STATUS_LABEL[status] ?? status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="dt-panel">
            {selectedDispute ? (
              <div className="dt-detail">
                <div className="dt-detail-title">
                  <div>
                    <h3>{DISPUTE_TYPE_LABEL[selectedDispute.type ?? "OTHER"] ?? selectedDispute.type ?? "분쟁 상세"}</h3>
                    <p className="dt-sub">분쟁 #{formatId(selectedDispute.id)}</p>
                  </div>
                  <span className={`dt-badge ${(selectedDispute.status ?? "OPEN").toLowerCase()}`}>
                    {DISPUTE_STATUS_LABEL[selectedDispute.status ?? "OPEN"] ?? selectedDispute.status}
                  </span>
                </div>

                <div className="dt-grid">
                  <div className="dt-field">
                    <span>리셀 거래</span>
                    <strong>#{formatId(selectedDispute.resaleListingId)}</strong>
                  </div>
                  <div className="dt-field">
                    <span>티켓</span>
                    <strong>#{formatId(selectedDispute.ticketId)}</strong>
                  </div>
                  <div className="dt-field">
                    <span>신고자</span>
                    <strong>#{formatId(selectedDispute.reporterId)}</strong>
                  </div>
                  <div className="dt-field">
                    <span>처리자</span>
                    <strong>#{formatId(selectedDispute.reviewedBy)}</strong>
                  </div>
                </div>

                <div className="dt-description">{selectedDispute.description || "분쟁 설명이 없습니다."}</div>

                <div className="dt-grid">
                  <div className="dt-field">
                    <span>연결 거래 상태</span>
                    <strong>{activeTransaction?.status ? RESALE_STATUS_LABEL[activeTransaction.status] ?? activeTransaction.status : "-"}</strong>
                  </div>
                  <div className="dt-field">
                    <span>거래 금액</span>
                    <strong>{formatWei(activeTransaction?.priceWei ?? activeTransaction?.price)}</strong>
                  </div>
                </div>

                <div className="dt-review">
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="처리 메모를 입력하세요"
                  />
                  <div className="dt-review-actions">
                    <button disabled={reviewingId === selectedDispute.id} onClick={() => void review("REVIEWING")} type="button">
                      검토중
                    </button>
                    <button
                      className="primary"
                      disabled={reviewingId === selectedDispute.id}
                      onClick={() => void review("RESOLVED")}
                      type="button"
                    >
                      해결 처리
                    </button>
                    <button
                      className="danger"
                      disabled={reviewingId === selectedDispute.id}
                      onClick={() => void review("REJECTED")}
                      type="button"
                    >
                      반려
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dt-empty">선택된 분쟁이 없습니다.</div>
            )}
          </section>
        </div>

        <section className="dt-panel">
          <div className="dt-panel-head">
            <h3>리셀 거래 모니터링</h3>
            <div className="dt-tabs">
              {transactionTabs.map((tab) => (
                <button
                  key={tab.value}
                  className={`dt-tab${transactionStatus === tab.value ? " active" : ""}`}
                  onClick={() => setTransactionStatus(tab.value)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <form className="dt-search" onSubmit={onSearch}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="거래, 티켓, 사용자 ID 검색" />
              <button type="submit">검색</button>
            </form>
          </div>
          <div className="dt-scroll">
            <table className="dt-transactions">
              <thead>
                <tr>
                  <th>거래 ID</th>
                  <th>티켓 / 이벤트</th>
                  <th>판매자</th>
                  <th>구매자</th>
                  <th>금액</th>
                  <th>상태</th>
                  <th>일시</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="dt-empty">불러오는 중...</td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="dt-empty">조건에 맞는 거래가 없습니다.</td>
                  </tr>
                ) : (
                  filteredTransactions.map((item) => {
                    const id = item.listingId ?? item.id;
                    const status = item.status ?? "ACTIVE";
                    return (
                      <tr key={String(id ?? JSON.stringify(item))}>
                        <td className="dt-mono">#{formatId(id)}</td>
                        <td>
                          <strong>#{formatId(item.ticketId)}</strong>
                          <p className="dt-sub">event #{formatId(item.eventId)}</p>
                        </td>
                        <td className="dt-mono">#{formatId(item.sellerId)}</td>
                        <td className="dt-mono">#{formatId(item.buyerId)}</td>
                        <td>{formatWei(item.priceWei ?? item.price)}</td>
                        <td>
                          <span className={`dt-badge ${status.toLowerCase()}`}>
                            {RESALE_STATUS_LABEL[status] ?? status}
                          </span>
                        </td>
                        <td>{formatDate(item.purchasedAt ?? item.updatedAt ?? item.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
