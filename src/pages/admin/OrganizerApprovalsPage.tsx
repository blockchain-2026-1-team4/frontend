import { useEffect, useMemo, useState } from "react";
import { AdminPagination } from "../../components/AdminPagination";
import { backendApi } from "../../lib/backend";
import { addOrganizerOnChain } from "../../lib/blockchain/client";
import type { OrganizerApplication } from "../../types/api";
import { buildAdminError, formatDateTime, shortId } from "./adminUtils";

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "거절됨",
};

function statusClass(status?: string) {
  if (status === "APPROVED") return "green";
  if (status === "REJECTED") return "red";
  return "on";
}

export function OrganizerApprovalsPage() {
  const [items, setItems] = useState<OrganizerApplication[]>([]);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("PENDING");
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState<number | undefined>();
  const [totalPages, setTotalPages] = useState<number | undefined>();
  const [hasNext, setHasNext] = useState(false);
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
        page,
        size: PAGE_SIZE,
      });
      setItems(data.items ?? []);
      setTotalElements(data.totalElements);
      setTotalPages(data.totalPages);
      setHasNext(data.hasNext ?? false);
    } catch (cause) {
      setItems([]);
      setTotalElements(undefined);
      setTotalPages(undefined);
      setHasNext(false);
      setError(buildAdminError(cause, "주최자 신청 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filterStatus, page]);

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

  async function review(item: OrganizerApplication, decision: "APPROVED" | "REJECTED") {
    if (!item.id) {
      setError("신청 ID를 확인할 수 없습니다.");
      return;
    }

    const confirmMessage = decision === "APPROVED" ? "이 주최자 신청을 승인할까요?" : "이 주최자 신청을 거절할까요?";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setReviewingId(item.id);
    setError(null);
    try {
      const transactionHash = decision === "APPROVED" ? await addOrganizerOnChain(String(item.userWalletAddress ?? "")) : undefined;
      await backendApi.reviewOrganizerApplication(item.id, decision, transactionHash);
      setMessage(decision === "APPROVED" ? "주최자 신청을 승인했습니다." : "주최자 신청을 거절했습니다.");
      await load();
    } catch (cause) {
      setError(buildAdminError(cause, "주최자 신청 심사에 실패했습니다."));
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
      <section className="hero">
        <div>
          <div className="eyebrow">실무 심사 테이블</div>
          <h2>주최자 신청 심사</h2>
          <p>주최자 권한 신청을 승인하거나 거절하고, 신청 상태와 검토 이력을 확인합니다.</p>
        </div>
        <div className="hero-stats">
          <div className="mini-stat">
            <div className="mini-label">승인 대기</div>
            <div className="mini-num">{pendingCount}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">승인됨</div>
            <div className="mini-num">{approvedCount}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">거절됨</div>
            <div className="mini-num">{rejectedCount}</div>
          </div>
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="toast">{message}</div> : null}

      <section className="section">
        <div className="section-head">
          <div className="section-title">신청 목록</div>
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
            <input
              className="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="상호명, 이메일, 회원 번호 검색"
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>신청 번호</th>
                <th>주최 정보</th>
                <th>연락 이메일</th>
                <th>신청 회원</th>
                <th>지갑 주소</th>
                <th>상태</th>
                <th>신청일</th>
                <th>담당 관리자</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty" colSpan={9}>불러오는 중...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={9}>조건에 맞는 주최자 신청이 없습니다.</td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const status = item.status ?? "PENDING";
                  const isPending = status === "PENDING";
                  const isBusy = reviewingId === item.id;

                  return (
                    <tr key={item.id ?? JSON.stringify(item)}>
                      <td className="mono">#{shortId(item.id)}</td>
                      <td>
                        <div className="name">{item.businessName || "상호명 없음"}</div>
                        <div className="sub">{item.description || "설명 없음"}</div>
                      </td>
                      <td>{item.contactEmail || "-"}</td>
                      <td className="mono">#{shortId(item.userId)}</td>
                      <td className="mono">#{shortId(item.userWalletAddress, 12)}</td>
                      <td><span className={`chip ${statusClass(status)}`}>{STATUS_LABEL[status] ?? status}</span></td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td className="mono">#{shortId(item.reviewedBy)}</td>
                      <td>
                        <div className="section-right">
                          <button className="btn" disabled={!isPending || isBusy} onClick={() => void review(item, "APPROVED")} type="button">
                            승인
                          </button>
                          <button className="btn red" disabled={!isPending || isBusy} onClick={() => void review(item, "REJECTED")} type="button">
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
