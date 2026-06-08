import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminPagination } from "../../components/AdminPagination";
import { backendApi } from "../../lib/backend";
import type { DisputeRecord, ResaleTransactionRecord } from "../../types/api";
import { buildAdminError, formatDateTime, formatWei, shortId, stringValue } from "./adminUtils";

type DisputeStatusFilter = "ALL" | "OPEN" | "REVIEWING" | "RESOLVED" | "REJECTED" | "CANCELED";
type ResaleStatusFilter = "ALL" | "ACTIVE" | "SOLD" | "CANCELED";
type ReviewStatus = "REVIEWING" | "RESOLVED" | "REJECTED";

const PAGE_SIZE = 20;

const DISPUTE_STATUS_LABEL: Record<string, string> = {
  OPEN: "접수",
  REVIEWING: "검토 중",
  RESOLVED: "해결",
  REJECTED: "반려",
  CANCELED: "취소됨",
};

const RESALE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "판매 중",
  SOLD: "거래 완료",
  CANCELED: "취소됨",
};

const DISPUTE_TYPE_LABEL: Record<string, string> = {
  TICKET_NOT_DELIVERED: "티켓 미전달",
  PAYMENT_ISSUE: "결제 문제",
  FRAUD_SUSPECTED: "사기 의심",
  OTHER: "기타",
};

function statusClass(status?: string) {
  if (status === "RESOLVED" || status === "SOLD") return "green";
  if (status === "REJECTED" || status === "CANCELED") return "red";
  return "on";
}

export function AdminDisputeTransactionPage() {
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [transactions, setTransactions] = useState<ResaleTransactionRecord[]>([]);
  const [disputeStatus, setDisputeStatus] = useState<DisputeStatusFilter>("ALL");
  const [transactionStatus, setTransactionStatus] = useState<ResaleStatusFilter>("ALL");
  const [disputePage, setDisputePage] = useState(0);
  const [transactionPage, setTransactionPage] = useState(0);
  const [disputeTotalElements, setDisputeTotalElements] = useState<number | undefined>();
  const [disputeTotalPages, setDisputeTotalPages] = useState<number | undefined>();
  const [disputeHasNext, setDisputeHasNext] = useState(false);
  const [transactionTotalElements, setTransactionTotalElements] = useState<number | undefined>();
  const [transactionTotalPages, setTransactionTotalPages] = useState<number | undefined>();
  const [transactionHasNext, setTransactionHasNext] = useState(false);
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
          page: disputePage,
          size: PAGE_SIZE,
        }),
        backendApi.getResaleTransactions({
          status: transactionStatus !== "ALL" ? transactionStatus : undefined,
          page: transactionPage,
          size: PAGE_SIZE,
        }),
      ]);
      setDisputes(disputeData.items ?? []);
      setTransactions(transactionData.items ?? []);
      setDisputeTotalElements(disputeData.totalElements);
      setDisputeTotalPages(disputeData.totalPages);
      setDisputeHasNext(disputeData.hasNext ?? false);
      setTransactionTotalElements(transactionData.totalElements);
      setTransactionTotalPages(transactionData.totalPages);
      setTransactionHasNext(transactionData.hasNext ?? false);
    } catch (cause) {
      setDisputes([]);
      setTransactions([]);
      setDisputeTotalElements(undefined);
      setDisputeTotalPages(undefined);
      setDisputeHasNext(false);
      setTransactionTotalElements(undefined);
      setTransactionTotalPages(undefined);
      setTransactionHasNext(false);
      setError(buildAdminError(cause, "신고 및 거래 데이터를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [disputeStatus, transactionStatus, disputePage, transactionPage]);

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
  const selectedListingId = stringValue(selectedDispute?.resaleListingId);
  const activeTransaction = selectedListingId
    ? transactions.find((item) => (item.listingId ?? item.id) === selectedListingId)
    : undefined;

  async function review(status: ReviewStatus) {
    if (!selectedDispute?.id) {
      return;
    }

    if (!window.confirm(`분쟁을 '${DISPUTE_STATUS_LABEL[status]}' 상태로 변경할까요?`)) {
      return;
    }

    setReviewingId(selectedDispute.id);
    setError(null);
    try {
      await backendApi.reviewDispute(selectedDispute.id, {
        status,
        resolutionNote: reviewNote.trim() || null,
      });
      setMessage(`분쟁을 '${DISPUTE_STATUS_LABEL[status]}' 상태로 변경했습니다.`);
      await load();
    } catch (cause) {
      setError(buildAdminError(cause, "분쟁 상태 변경에 실패했습니다."));
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
    { label: "검토 중", value: "REVIEWING" },
    { label: "해결", value: "RESOLVED" },
    { label: "반려", value: "REJECTED" },
    { label: "취소됨", value: "CANCELED" },
  ];

  const transactionTabs: { label: string; value: ResaleStatusFilter }[] = [
    { label: "전체", value: "ALL" },
    { label: "판매 중", value: "ACTIVE" },
    { label: "거래 완료", value: "SOLD" },
    { label: "취소됨", value: "CANCELED" },
  ];

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">좌측 목록 + 우측 상세</div>
          <h2>신고 접수와 리셀 거래 모니터링</h2>
          <p>분쟁은 왼쪽 목록에서 선택하고 오른쪽에서 상세를 확인합니다. 리셀 거래는 하단에서 별도로 모니터링합니다.</p>
        </div>
        <div className="hero-stats">
          <div className="mini-stat">
            <div className="mini-label">처리 대기</div>
            <div className="mini-num">{pendingCount}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">거래 완료</div>
            <div className="mini-num">{soldCount}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">조회 거래</div>
            <div className="mini-num">{filteredTransactions.length}</div>
          </div>
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="toast">{message}</div> : null}

      <div className="split">
        <section className="section">
          <div className="section-head">
            <div className="section-title">신고 접수 목록</div>
            <div className="section-right">
              {disputeTabs.map((tab) => (
                <button
                  className={`chip${disputeStatus === tab.value ? " on" : ""}`}
                  key={tab.value}
                  onClick={() => {
                    setDisputePage(0);
                    setDisputeStatus(tab.value);
                  }}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="empty">불러오는 중...</div>
          ) : disputes.length === 0 ? (
            <div className="empty">
              <i className="ti ti-inbox" />
              <div>현재 처리할 신고가 없습니다.</div>
              <small>새 신고가 접수되면 이곳에 표시됩니다.</small>
            </div>
          ) : (
            <div className="todo-list">
              {disputes.map((item) => {
                const status = item.status ?? "OPEN";
                return (
                  <button
                    className="todo-row dispute-row"
                    key={item.id ?? JSON.stringify(item)}
                    onClick={() => setSelectedDisputeId(item.id ?? null)}
                    type="button"
                  >
                    <span className="todo-num dispute-id">#{shortId(item.id, 4)}</span>
                    <span className="dispute-copy">
                      <span className="todo-title">{DISPUTE_TYPE_LABEL[item.type ?? "OTHER"] ?? item.type ?? "분쟁"}</span>
                      <span className="todo-sub">신고자 #{shortId(item.reporterId)} · {formatDateTime(item.createdAt)}</span>
                    </span>
                    <span className={`chip ${statusClass(status)}`}>{DISPUTE_STATUS_LABEL[status] ?? status}</span>
                  </button>
                );
              })}
            </div>
          )}

          <AdminPagination
            page={disputePage}
            size={PAGE_SIZE}
            totalElements={disputeTotalElements}
            totalPages={disputeTotalPages}
            hasNext={disputeHasNext}
            loading={loading}
            onPageChange={setDisputePage}
          />
        </section>

        <section className="section">
          {selectedDispute ? (
            <>
              <div className="section-head">
                <div>
                  <div className="section-title">{DISPUTE_TYPE_LABEL[selectedDispute.type ?? "OTHER"] ?? selectedDispute.type ?? "분쟁 상세"}</div>
                  <div className="sub">분쟁 #{shortId(selectedDispute.id)}</div>
                </div>
                <span className={`chip ${statusClass(selectedDispute.status)}`}>
                  {DISPUTE_STATUS_LABEL[selectedDispute.status ?? "OPEN"] ?? selectedDispute.status}
                </span>
              </div>
              <div className="help">{selectedDispute.description || "등록된 분쟁 설명이 없습니다."}</div>
              <div className="metrics-grid">
                <article className="metric-card">
                  <div className="metric-label">리셀 거래</div>
                  <div className="metric-value">#{shortId(selectedListingId)}</div>
                </article>
                <article className="metric-card">
                  <div className="metric-label">티켓</div>
                  <div className="metric-value">#{shortId(selectedDispute.ticketId)}</div>
                </article>
                <article className="metric-card">
                  <div className="metric-label">신고자</div>
                  <div className="metric-value">#{shortId(selectedDispute.reporterId)}</div>
                </article>
                <article className="metric-card">
                  <div className="metric-label">거래 금액</div>
                  <div className="metric-value">{formatWei(activeTransaction?.priceWei ?? activeTransaction?.price)}</div>
                </article>
              </div>
              <div className="help">
                <label className="field">
                  <span>처리 메모</span>
                  <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="처리 메모를 입력하세요." />
                </label>
                <div className="section-right">
                  <button className="btn out" disabled={reviewingId === selectedDispute.id} onClick={() => void review("REVIEWING")} type="button">
                    검토 중
                  </button>
                  <button className="btn" disabled={reviewingId === selectedDispute.id} onClick={() => void review("RESOLVED")} type="button">
                    해결
                  </button>
                  <button className="btn red" disabled={reviewingId === selectedDispute.id} onClick={() => void review("REJECTED")} type="button">
                    반려
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="detail">
              <i className="ti ti-click" />
              <div>선택한 신고가 없습니다.</div>
              <small>좌측 목록에서 신고를 선택하면 상세 정보가 표시됩니다.</small>
            </div>
          )}
        </section>
      </div>

      <section className="section">
        <div className="section-head">
          <div className="section-title">리셀 거래 모니터링</div>
          <div className="section-right">
            {transactionTabs.map((tab) => (
              <button
                className={`chip${transactionStatus === tab.value ? " on" : ""}`}
                key={tab.value}
                onClick={() => {
                  setTransactionPage(0);
                  setTransactionStatus(tab.value);
                }}
                type="button"
              >
                {tab.label}
              </button>
            ))}
            <form className="section-right" onSubmit={onSearch}>
              <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="거래, 티켓, 회원 번호 검색" />
              <button className="btn" type="submit">검색</button>
            </form>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
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
                  <td className="empty" colSpan={7}>불러오는 중...</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={7}>조건에 맞는 거래가 없습니다.</td>
                </tr>
              ) : (
                filteredTransactions.map((item) => {
                  const id = item.listingId ?? item.id;
                  const status = item.status ?? "ACTIVE";
                  return (
                    <tr key={String(id ?? JSON.stringify(item))}>
                      <td className="mono">#{shortId(id)}</td>
                      <td>
                        <div className="name">#{shortId(item.ticketId)}</div>
                        <div className="sub">이벤트 #{shortId(item.eventId)}</div>
                      </td>
                      <td className="mono">#{shortId(item.sellerId)}</td>
                      <td className="mono">#{shortId(item.buyerId)}</td>
                      <td>{formatWei(item.priceWei ?? item.price)}</td>
                      <td><span className={`chip ${statusClass(status)}`}>{RESALE_STATUS_LABEL[status] ?? status}</span></td>
                      <td>{formatDateTime(item.purchasedAt ?? item.updatedAt ?? item.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          page={transactionPage}
          size={PAGE_SIZE}
          totalElements={transactionTotalElements}
          totalPages={transactionTotalPages}
          hasNext={transactionHasNext}
          loading={loading}
          onPageChange={setTransactionPage}
        />
      </section>
    </>
  );
}
