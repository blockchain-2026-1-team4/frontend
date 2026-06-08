import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminPagination } from "../../components/AdminPagination";
import { backendApi } from "../../lib/backend";
import type { UserAdminRecord } from "../../types/api";
import { buildAdminError, formatDate, shortId } from "./adminUtils";

type UserStatusFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "DELETED";
type UserRoleFilter = "USER" | "ORGANIZER" | "VALIDATOR" | "ADMIN";
type UserAction = "suspend" | "activate" | "delete" | "grantValidator" | "revokeValidator" | "grantOrganizer" | "revokeOrganizer";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "활성",
  SUSPENDED: "정지",
  DELETED: "삭제",
  PENDING: "대기",
};

const ROLE_LABEL: Record<string, string> = {
  USER: "회원",
  ADMIN: "관리자",
  ORGANIZER: "주최자",
  VALIDATOR: "입장 검증자",
};

function normalizeStatus(status?: string) {
  return (status ?? "ACTIVE").toUpperCase();
}

function roleClass(role: string) {
  if (role === "ADMIN") return "red";
  if (role === "ORGANIZER") return "green";
  if (role === "VALIDATOR") return "orange";
  return "";
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "green";
  if (status === "SUSPENDED") return "orange";
  if (status === "DELETED") return "red";
  return "";
}

export function AdminUserManagePage() {
  const [items, setItems] = useState<UserAdminRecord[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<UserStatusFilter>("ALL");
  const [roleFilters, setRoleFilters] = useState<UserRoleFilter[]>([]);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState<number | undefined>();
  const [totalPages, setTotalPages] = useState<number | undefined>();
  const [hasNext, setHasNext] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const data = await backendApi.getUsers({
        page,
        size: PAGE_SIZE,
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
      setError(buildAdminError(cause, "회원 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filterStatus, page]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((user) => {
      const roles = user.roles?.length ? user.roles : ["USER"];
      const matchesRole = roleFilters.length === 0 || roleFilters.every((role) => roles.includes(role));
      if (!matchesRole) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [user.email, user.displayName, user.walletAddress, user.id, ...roles]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [items, query, roleFilters]);

  async function runAction(userId: string, action: UserAction) {
    const confirmMessages: Record<UserAction, string> = {
      suspend: "이 사용자를 정지할까요?",
      activate: "이 사용자를 다시 활성화할까요?",
      delete: "이 사용자를 삭제 처리할까요?",
      grantValidator: "이 사용자에게 검증자 권한을 부여할까요?",
      revokeValidator: "이 사용자에게서 검증자 권한을 회수할까요?",
      grantOrganizer: "이 사용자에게 주최자 권한을 부여할까요?",
      revokeOrganizer: "이 사용자에게서 주최자 권한을 회수할까요?",
    };

    if (!window.confirm(confirmMessages[action])) {
      return;
    }

    setActionUserId(userId);
    setError(null);
    try {
      if (action === "suspend") {
        await backendApi.suspendUser(userId);
        setActionMessage("사용자를 정지했습니다.");
      }
      if (action === "activate") {
        await backendApi.activateUser(userId);
        setActionMessage("사용자를 다시 활성화했습니다.");
      }
      if (action === "delete") {
        await backendApi.deleteUser(userId);
        setActionMessage("사용자를 삭제 처리했습니다.");
      }
      if (action === "grantValidator") {
        await backendApi.grantValidator(userId);
        setActionMessage("검증자 권한을 부여했습니다.");
      }
      if (action === "revokeValidator") {
        await backendApi.revokeValidator(userId);
        setActionMessage("검증자 권한을 회수했습니다.");
      }
      if (action === "grantOrganizer") {
        await backendApi.grantOrganizer(userId);
        setActionMessage("주최자 권한을 부여했습니다.");
      }
      if (action === "revokeOrganizer") {
        await backendApi.revokeOrganizer(userId);
        setActionMessage("주최자 권한을 회수했습니다.");
      }
      await load();
    } catch (cause) {
      setError(buildAdminError(cause, "회원 상태 변경에 실패했습니다."));
    } finally {
      setActionUserId(null);
      window.setTimeout(() => setActionMessage(null), 3000);
    }
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
  }

  function toggleRoleFilter(role: UserRoleFilter) {
    setPage(0);
    setRoleFilters((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  }

  const filterTabs: { label: string; value: UserStatusFilter }[] = [
    { label: "전체", value: "ALL" },
    { label: "활성", value: "ACTIVE" },
    { label: "정지", value: "SUSPENDED" },
    { label: "삭제", value: "DELETED" },
  ];

  const roleTabs: { label: string; value: UserRoleFilter }[] = [
    { label: "회원", value: "USER" },
    { label: "주최자", value: "ORGANIZER" },
    { label: "검증자", value: "VALIDATOR" },
    { label: "관리자", value: "ADMIN" },
  ];

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">실무용 계정 테이블</div>
          <h2>회원 계정 및 권한 관리</h2>
          <p>회원 상태와 권한을 관리합니다. 검증자 권한은 현장 QR 체크인 처리 권한입니다.</p>
        </div>
        <form className="section-right" onSubmit={onSearch}>
          <input
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름, 이메일, 지갑 주소 검색"
          />
          <button className="btn" type="submit">검색</button>
        </form>
      </section>

      <section className="section">
        <div className="help">
          <strong>검증자</strong>: 현장에서 QR 체크인 처리를 수행할 수 있는 권한입니다. 선택한 역할이 여러 개면 모든 역할을 가진 계정만 표시됩니다.
        </div>
        <div className="section-head">
          <div className="section-title">회원 목록</div>
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
        </div>
        <div className="section-head">
          <div className="section-right">
            {roleTabs.map((tab) => (
              <button
                className={`chip${roleFilters.includes(tab.value) ? " on" : ""}`}
                key={tab.value}
                onClick={() => toggleRoleFilter(tab.value)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="chip">{hasLoaded ? `${filteredItems.length}건` : "집계 중"}</span>
        </div>

        {actionMessage ? <div className="toast">{actionMessage}</div> : null}
        {error ? <div className="alert">{error}</div> : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>회원 번호</th>
                <th>회원 정보</th>
                <th>권한</th>
                <th>상태</th>
                <th>지갑 주소</th>
                <th>가입일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty" colSpan={7}>불러오는 중...</td>
                </tr>
              ) : !hasLoaded ? (
                <tr>
                  <td className="empty" colSpan={7}>회원 목록을 불러오지 못했습니다.</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={7}>조건에 맞는 회원이 없습니다.</td>
                </tr>
              ) : (
                filteredItems.map((user) => {
                  const status = normalizeStatus(user.status);
                  const isBusy = actionUserId === user.id;
                  const isSuspended = status === "SUSPENDED";
                  const isDeleted = status === "DELETED";
                  const roles = user.roles?.length ? user.roles : ["USER"];
                  const hasValidatorRole = roles.includes("VALIDATOR");
                  const hasOrganizerRole = roles.includes("ORGANIZER");

                  return (
                    <tr key={user.id}>
                      <td className="mono">#{shortId(user.id)}</td>
                      <td>
                        <div className="name">{user.displayName || "이름 없음"}</div>
                        <div className="sub">{user.email || "-"}</div>
                      </td>
                      <td>
                        <div className="section-right">
                          {roles.map((role) => (
                            <span className={`chip ${roleClass(role)}`} key={role}>{ROLE_LABEL[role] ?? role}</span>
                          ))}
                        </div>
                      </td>
                      <td><span className={`chip ${statusClass(status)}`}>{STATUS_LABEL[status] ?? status}</span></td>
                      <td className="mono" title={user.walletAddress}>{shortId(user.walletAddress, 14)}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="section-right">
                          {isSuspended ? (
                            <button className="btn" disabled={isBusy || isDeleted} onClick={() => void runAction(user.id, "activate")} type="button">
                              활성화
                            </button>
                          ) : (
                            <button className="btn out" disabled={isBusy || isDeleted} onClick={() => void runAction(user.id, "suspend")} type="button">
                              정지
                            </button>
                          )}
                          <button
                            className="btn out"
                            disabled={isBusy || isDeleted}
                            onClick={() => void runAction(user.id, hasValidatorRole ? "revokeValidator" : "grantValidator")}
                            type="button"
                          >
                            {hasValidatorRole ? "검증자 회수" : "검증자 부여"}
                          </button>
                          <button
                            className="btn out"
                            disabled={isBusy || isDeleted}
                            onClick={() => void runAction(user.id, hasOrganizerRole ? "revokeOrganizer" : "grantOrganizer")}
                            type="button"
                          >
                            {hasOrganizerRole ? "주최자 회수" : "주최자 부여"}
                          </button>
                          <button className="btn red" disabled={isBusy || isDeleted} onClick={() => void runAction(user.id, "delete")} type="button">
                            삭제
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
