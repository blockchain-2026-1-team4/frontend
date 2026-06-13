import { FormEvent, useEffect, useMemo, useState } from "react";
import { backendApi } from "../../lib/backend";
import type { BlockchainTransactionRecord } from "../../types/api";
import { buildAdminError, formatDateTime, shortId } from "./adminUtils";

type StatusFilter = "ALL" | "SIMULATED" | "SUBMITTED" | "CONFIRMED" | "FAILED";

const STATUS_LABEL: Record<string, string> = {
  SIMULATED: "시뮬레이션",
  SUBMITTED: "제출 완료",
  CONFIRMED: "확정",
  FAILED: "실패",
};

const ACTION_LABEL: Record<string, string> = {
  addOrganizer: "주최자 등록",
  addValidator: "검증자 등록",
  addEventValidator: "이벤트 검증자 등록",
  createEvent: "이벤트 생성",
  setEventStatus: "이벤트 상태 변경",
  cancelEvent: "이벤트 취소",
  mintTicket: "티켓 발행",
  burnUnissuedTicket: "미판매 티켓 소각",
  purchaseTicket: "1차 티켓 구매",
  listTicket: "리셀 등록",
  purchaseResaleTicket: "리셀 구매",
  cancelListing: "리셀 등록 취소",
  useTicket: "체크인 처리",
  refundTicket: "환불 처리",
  withdrawEventRevenue: "이벤트 정산",
  withdrawResaleRevenue: "리셀 정산",
};

function statusClass(status?: string) {
  if (status === "CONFIRMED") return "green";
  if (status === "SUBMITTED") return "on";
  if (status === "FAILED") return "red";
  return "on";
}

function getTransactionTimestamp(item: BlockchainTransactionRecord) {
  const timestamp = item.createdAt ?? item.updatedAt;
  if (!timestamp) {
    return 0;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function targetLabel(item: BlockchainTransactionRecord) {
  const parts = [
    item.contractEventId ? `Event #${item.contractEventId}` : "",
    item.contractTokenId ? `Token #${item.contractTokenId}` : "",
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" · ");
  }
  return shortId(item.contractAddress, 14);
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
      const data = await backendApi.getBlockchainTransactions({ size: 80 });
      setItems(data);
      setHasLoaded(true);
    } catch (cause) {
      setItems([]);
      setHasLoaded(false);
      setError(buildAdminError(cause, "블록체인 로그를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return [...items]
      .sort((left, right) => getTransactionTimestamp(right) - getTransactionTimestamp(left))
      .filter((item) => {
        const matchesStatus = status === "ALL" || item.status === status;
        if (!matchesStatus) {
          return false;
        }
        if (!keyword) {
          return true;
        }
        return [
          item.id,
          item.action,
          item.transactionHash,
          item.txHash,
          item.contractAddress,
          item.contractEventId,
          item.contractTokenId,
          item.status,
          item.errorMessage,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
  }, [items, query, status]);

  const failedCount = items.filter((item) => item.status === "FAILED").length;
  const confirmedCount = items.filter((item) => item.status === "CONFIRMED").length;
  const submittedCount = items.filter((item) => item.status === "SUBMITTED").length;
  const simulatedCount = items.filter((item) => item.status === "SIMULATED").length;

  function onSearch(event: FormEvent) {
    event.preventDefault();
  }

  const filterTabs: { label: string; value: StatusFilter }[] = [
    { label: "전체", value: "ALL" },
    { label: "시뮬레이션", value: "SIMULATED" },
    { label: "제출 완료", value: "SUBMITTED" },
    { label: "확정", value: "CONFIRMED" },
    { label: "실패", value: "FAILED" },
  ];

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">로그 뷰어</div>
          <h2>블록체인 처리 현황</h2>
          <p>서버가 기록한 체인 제출, 시뮬레이션, 처리 실패 기록을 조회합니다.</p>
        </div>
        <div className="hero-stats">
          <div className="mini-stat">
            <div className="mini-label">시뮬레이션</div>
            <div className="mini-num">{simulatedCount}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">제출 완료</div>
            <div className="mini-num">{submittedCount}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">확정</div>
            <div className="mini-num">{confirmedCount}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">실패</div>
            <div className="mini-num">{failedCount}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div className="section-title">상태 안내</div>
        </div>
        <div className="status-strip">
          <div className="status-note">
            <div className="bar" />
            <b>시뮬레이션</b>
            <div className="sub">실제 체인 전송 없이 내부 기록만 남긴 상태입니다.</div>
          </div>
          <div className="status-note">
            <div className="bar" />
            <b>제출 완료</b>
            <div className="sub">체인 제출 후 트랜잭션 해시를 받은 상태입니다.</div>
          </div>
          <div className="status-note">
            <div className="bar" />
            <b>확정</b>
            <div className="sub">체인 영수증까지 확인되어 온체인 처리가 완료된 상태입니다.</div>
          </div>
          <div className="status-note">
            <div className="bar" />
            <b>실패</b>
            <div className="sub">체인 제출 또는 기록 처리 중 실패한 상태입니다.</div>
          </div>
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <section className="section">
        <div className="section-head">
          <div className="section-title">최근 처리 기록</div>
          <div className="section-right">
            {filterTabs.map((tab) => (
              <button className={`chip${status === tab.value ? " on" : ""}`} key={tab.value} onClick={() => setStatus(tab.value)} type="button">
                {tab.label}
              </button>
            ))}
            <form className="section-right" onSubmit={onSearch}>
              <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="작업, 해시, Event/Token 검색" />
              <button className="btn" type="submit">검색</button>
            </form>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>기록 번호</th>
                <th>작업</th>
                <th>트랜잭션 해시</th>
                <th>온체인 대상</th>
                <th>상태</th>
                <th>오류</th>
                <th>생성일</th>
                <th>수정일</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty" colSpan={8}>불러오는 중...</td>
                </tr>
              ) : !hasLoaded ? (
                <tr>
                  <td className="empty" colSpan={8}>블록체인 로그를 불러오지 못했습니다.</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={8}>조건에 맞는 로그가 없습니다.</td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const txHash = item.transactionHash ?? item.txHash;
                  const itemStatus = item.status ?? "SIMULATED";
                  return (
                    <tr key={item.id ?? `${item.action}-${item.createdAt}`}>
                      <td className="mono">#{shortId(item.id)}</td>
                      <td className="name">{item.action ? ACTION_LABEL[item.action] ?? item.action : "-"}</td>
                      <td className="mono" title={txHash}>{shortId(txHash, 18)}</td>
                      <td className="mono" title={item.contractAddress}>{targetLabel(item)}</td>
                      <td><span className={`chip ${statusClass(itemStatus)}`}>{STATUS_LABEL[itemStatus] ?? itemStatus}</span></td>
                      <td className="sub" title={item.errorMessage}>{item.errorMessage ?? "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDateTime(item.updatedAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
