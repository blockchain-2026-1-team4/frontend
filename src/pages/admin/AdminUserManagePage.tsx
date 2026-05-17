import { FormEvent, useEffect, useMemo, useState } from "react";
import { backendApi } from "../../lib/backend";
import type { UserAdminRecord } from "../../types/api";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "활성",
  SUSPENDED: "정지",
  DELETED: "삭제",
  PENDING: "대기",
};

const ROLE_LABEL: Record<string, string> = {
  USER: "사용자",
  ADMIN: "관리자",
  ORGANIZER: "주최자",
  VALIDATOR: "검증자",
};

type UserStatusFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "DELETED";

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function normalizeStatus(status?: string) {
  return (status ?? "ACTIVE").toUpperCase();
}

export function AdminUserManagePage() {
  const [items, setItems] = useState<UserAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<UserStatusFilter>("ALL");
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await backendApi.getUsers({
        status: filterStatus !== "ALL" ? filterStatus : undefined,
      });
      setItems(data.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "사용자 목록을 불러오지 못했습니다.");
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

    return items.filter((user) => {
      const haystack = [user.email, user.displayName, user.walletAddress, user.id, ...(user.roles ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [items, query]);

  async function runAction(userId: string, action: "suspend" | "activate" | "delete" | "validator") {
    setActionUserId(userId);
    setError(null);
    try {
      if (action === "suspend") {
        await backendApi.suspendUser(userId);
        setActionMessage("사용자를 정지했습니다.");
      }
      if (action === "activate") {
        await backendApi.activateUser(userId);
        setActionMessage("사용자를 활성화했습니다.");
      }
      if (action === "delete") {
        await backendApi.deleteUser(userId);
        setActionMessage("사용자를 삭제 처리했습니다.");
      }
      if (action === "validator") {
        await backendApi.grantValidator(userId);
        setActionMessage("검증자 권한을 부여했습니다.");
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청 처리 중 오류가 발생했습니다.");
    } finally {
      setActionUserId(null);
      window.setTimeout(() => setActionMessage(null), 3000);
    }
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
  }

  const filterTabs: { label: string; value: UserStatusFilter }[] = [
    { label: "전체", value: "ALL" },
    { label: "활성", value: "ACTIVE" },
    { label: "정지", value: "SUSPENDED" },
    { label: "삭제", value: "DELETED" },
  ];

  return (
    <>
      <style>{`
        .user-page { display: grid; gap: 1rem; }
        .user-header { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 1.2rem 1.4rem; box-shadow: var(--shadow); }
        .user-toprow { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .user-title-group { display: grid; gap: 0.2rem; }
        .user-title-group .eyebrow { margin: 0; }
        .user-title-group h2 { margin: 0; font-size: 1.4rem; }
        .user-search-form { display: flex; gap: 0.5rem; align-items: center; }
        .user-search-input { border-radius: 10px; border: 1px solid var(--border-strong); padding: 0.5rem 0.75rem; font-size: 0.9rem; width: 260px; color: var(--txt-main); background: #fff; }
        .user-search-input::placeholder { color: #8a97a8; }
        .user-search-btn { border: 1px solid var(--border); background: var(--panel); color: var(--txt-main); border-radius: 10px; padding: 0.5rem 0.85rem; cursor: pointer; font-size: 0.9rem; font-weight: 600; }
        .user-search-btn:hover { background: var(--bg-1); }
        .user-filter-tabs { display: flex; gap: 0.4rem; margin-top: 1rem; flex-wrap: wrap; }
        .user-filter-tab { border: 1px solid var(--border); background: var(--panel-soft); color: var(--txt-sub); border-radius: 999px; padding: 0.38rem 0.9rem; font-size: 0.83rem; font-weight: 600; cursor: pointer; }
        .user-filter-tab:hover { background: var(--bg-1); color: var(--txt-main); }
        .user-filter-tab.active { background: #e8f1ff; border-color: #cfe0ff; color: var(--accent-2); }
        .user-toast { background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; border-radius: 10px; padding: 0.6rem 1rem; font-size: 0.88rem; font-weight: 600; margin-top: 0.75rem; }
        .user-error { background: #fff5f5; border: 1px solid #ffcdd2; color: #c62828; border-radius: 10px; padding: 0.6rem 1rem; font-size: 0.88rem; font-weight: 600; margin-top: 0.75rem; }
        .user-table-shell { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
        .user-table-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, #fff, #f7f9fc); }
        .user-table-head h3 { margin: 0; font-size: 0.95rem; font-weight: 700; }
        .user-count-badge { background: #e8f1ff; color: var(--accent-2); border-radius: 999px; padding: 0.28rem 0.7rem; font-size: 0.78rem; font-weight: 700; }
        .user-table-wrap { overflow-x: auto; }
        .user-table { width: 100%; min-width: 920px; border-collapse: collapse; font-size: 0.88rem; }
        .user-table thead tr { background: #f8fafc; border-bottom: 1px solid var(--border); }
        .user-table th { padding: 0.7rem 1rem; text-align: left; font-size: 0.78rem; font-weight: 700; color: var(--txt-sub); white-space: nowrap; }
        .user-table td { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--txt-main); }
        .user-table tbody tr:last-child td { border-bottom: 0; }
        .user-table tbody tr:hover { background: #fafcff; }
        .user-id { font-family: "Courier New", monospace; font-size: 0.78rem; color: var(--txt-sub); white-space: nowrap; }
        .user-name { font-weight: 700; }
        .user-email { color: var(--txt-sub); font-size: 0.82rem; margin-top: 0.15rem; }
        .user-wallet { color: var(--txt-sub); font-size: 0.8rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .user-role-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
        .user-role { display: inline-flex; align-items: center; border-radius: 999px; background: #f1f5f9; color: #475569; padding: 0.25rem 0.55rem; font-size: 0.74rem; font-weight: 700; white-space: nowrap; }
        .user-status { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.28rem 0.65rem; font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
        .user-status.active { background: #e8f5e9; color: #2e7d32; }
        .user-status.suspended { background: #fff3e0; color: #e65100; }
        .user-status.deleted { background: #fce4ec; color: #c62828; }
        .user-status.pending { background: #e8f1ff; color: var(--accent-2); }
        .user-date { color: var(--txt-sub); white-space: nowrap; }
        .user-actions { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
        .user-action-btn { border: 1px solid var(--border); background: var(--panel-soft); color: var(--txt-main); border-radius: 8px; padding: 0.38rem 0.65rem; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
        .user-action-btn:hover { background: var(--bg-1); }
        .user-action-btn.primary { border-color: #cfe0ff; background: #e8f1ff; color: var(--accent-2); }
        .user-action-btn.danger { border-color: #ffcdd2; background: #fff5f5; color: #c62828; }
        .user-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .user-empty { text-align: center; padding: 3rem 1rem; color: var(--txt-sub); }
        .user-loading td { text-align: center; padding: 3rem; color: var(--txt-sub); }
      `}</style>

      <div className="user-page">
        <div className="user-header">
          <div className="user-toprow">
            <div className="user-title-group">
              <p className="eyebrow">사용자 관리</p>
              <h2>회원 계정 관리</h2>
            </div>
            <form className="user-search-form" onSubmit={onSearch}>
              <input
                className="user-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름, 이메일, 지갑 주소 검색"
              />
              <button className="user-search-btn" type="submit">
                검색
              </button>
            </form>
          </div>

          <div className="user-filter-tabs">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                className={`user-filter-tab${filterStatus === tab.value ? " active" : ""}`}
                onClick={() => setFilterStatus(tab.value)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {actionMessage ? <div className="user-toast">{actionMessage}</div> : null}
          {error ? <div className="user-error">{error}</div> : null}
        </div>

        <div className="user-table-shell">
          <div className="user-table-head">
            <h3>사용자 목록</h3>
            <span className="user-count-badge">{filteredItems.length}건</span>
          </div>

          {filteredItems.length === 0 && !loading ? (
            <div className="user-empty">
              <p>조건에 맞는 사용자가 없습니다.</p>
            </div>
          ) : (
            <div className="user-table-wrap">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>사용자 ID</th>
                    <th>회원 정보</th>
                    <th>역할</th>
                    <th>상태</th>
                    <th>지갑 주소</th>
                    <th>가입일</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="user-loading">
                      <td colSpan={7}>불러오는 중...</td>
                    </tr>
                  ) : (
                    filteredItems.map((user) => {
                      const status = normalizeStatus(user.status);
                      const isBusy = actionUserId === user.id;
                      const isSuspended = status === "SUSPENDED";
                      const isDeleted = status === "DELETED";
                      const hasValidatorRole = user.roles?.includes("VALIDATOR");

                      return (
                        <tr key={user.id}>
                          <td className="user-id">#{String(user.id).slice(0, 8)}</td>
                          <td>
                            <div className="user-name">{user.displayName || "이름 없음"}</div>
                            <div className="user-email">{user.email || "-"}</div>
                          </td>
                          <td>
                            <div className="user-role-list">
                              {(user.roles?.length ? user.roles : ["USER"]).map((role) => (
                                <span className="user-role" key={role}>
                                  {ROLE_LABEL[role] ?? role}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <span className={`user-status ${status.toLowerCase()}`}>
                              {STATUS_LABEL[status] ?? status}
                            </span>
                          </td>
                          <td>
                            <div className="user-wallet" title={user.walletAddress}>
                              {user.walletAddress || "-"}
                            </div>
                          </td>
                          <td className="user-date">{formatDate(user.createdAt)}</td>
                          <td>
                            <div className="user-actions">
                              {isSuspended ? (
                                <button
                                  className="user-action-btn primary"
                                  disabled={isBusy || isDeleted}
                                  onClick={() => void runAction(user.id, "activate")}
                                  type="button"
                                >
                                  활성화
                                </button>
                              ) : (
                                <button
                                  className="user-action-btn"
                                  disabled={isBusy || isDeleted}
                                  onClick={() => void runAction(user.id, "suspend")}
                                  type="button"
                                >
                                  정지
                                </button>
                              )}
                              <button
                                className="user-action-btn"
                                disabled={isBusy || isDeleted || hasValidatorRole}
                                onClick={() => void runAction(user.id, "validator")}
                                type="button"
                              >
                                검증자
                              </button>
                              <button
                                className="user-action-btn danger"
                                disabled={isBusy || isDeleted}
                                onClick={() => void runAction(user.id, "delete")}
                                type="button"
                              >
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
          )}
        </div>
      </div>
    </>
  );
}
