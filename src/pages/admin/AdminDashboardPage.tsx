import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { AdminDashboardSummary } from "../../types/api";

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
  return "대시보드 메트릭을 불러오지 못했습니다.";
}

function formatCount(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  return value.toLocaleString("ko-KR");
}

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const me = await backendApi.getMe();
        if (!me.roles?.includes("ADMIN")) {
          setDashboard(null);
          setError("관리자 대시보드는 관리자 로그인이 필요합니다. 관리자 계정으로 다시 로그인하세요.");
          return;
        }

        setDashboard(await backendApi.getAdminDashboard());
      } catch (cause) {
        setDashboard(null);
        setError(buildError(cause));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const metrics = [
    {
      label: "활성 이벤트",
      value: dashboard?.activeEventCount,
      hint: "현재 운영 중인 이벤트",
    },
    {
      label: "판매 티켓",
      value: dashboard?.soldTicketCount,
      hint: "누적 판매된 티켓",
    },
    {
      label: "사용 티켓",
      value: dashboard?.usedTicketCount,
      hint: "입장 처리된 티켓",
    },
    {
      label: "활성 리셀",
      value: dashboard?.activeResaleListingCount,
      hint: "현재 판매 중인 리셀",
    },
  ];

  return (
    <>
      <style>{`
        .dash-page { display: grid; gap: 1rem; }
        .dash-hero { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 1.25rem 1.4rem; box-shadow: var(--shadow); display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
        .dash-title .eyebrow { margin: 0; }
        .dash-title h2 { margin: 0.15rem 0 0; font-size: 1.45rem; }
        .dash-title p { margin: 0.45rem 0 0; color: var(--txt-sub); }
        .dash-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .dash-alert { background: #fff5f5; border: 1px solid #ffcdd2; color: #c62828; border-radius: 12px; padding: 0.75rem 1rem; font-weight: 800; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .dash-alert .button { border-color: #ffcdd2; background: #fff; color: #c62828; padding: 0.35rem 0.65rem; }
        .dash-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.85rem; }
        .dash-card { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 1rem; box-shadow: var(--shadow); min-height: 112px; }
        .dash-card span { display: block; color: var(--txt-sub); font-size: 0.8rem; font-weight: 800; }
        .dash-card strong { display: block; margin-top: 0.45rem; font-size: 1.85rem; color: var(--txt-main); font-variant-numeric: tabular-nums; }
        .dash-card p { margin: 0.35rem 0 0; color: var(--txt-sub); font-size: 0.82rem; }
        .dash-panel { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
        .dash-panel-head { padding: 1rem 1.15rem; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, #fff, #f7f9fc); display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
        .dash-panel-head h3 { margin: 0; font-size: 1rem; }
        .dash-quick { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; padding: 1rem; }
        .dash-link { border: 1px solid var(--border); border-radius: 14px; padding: 0.9rem; text-decoration: none; color: var(--txt-main); background: #fbfcfe; }
        .dash-link strong { display: block; }
        .dash-link span { display: block; margin-top: 0.28rem; color: var(--txt-sub); font-size: 0.82rem; }
        .dash-loading { padding: 1rem; color: var(--txt-sub); }
        @media (max-width: 1000px) {
          .dash-grid, .dash-quick { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .dash-grid, .dash-quick { grid-template-columns: 1fr; }
        }
      `}</style>

      <section className="dash-page">
        <header className="dash-hero">
          <div className="dash-title">
            <p className="eyebrow">관리자 웹 포털</p>
            <h2>관리자 대시보드</h2>
            <p>이벤트, 티켓, 리셀 운영 지표를 API 기준으로 확인합니다.</p>
          </div>
          <div className="dash-actions">
            <Link className="button primary" to="/admin/organizer-approvals">
              주최자 승인
            </Link>
            <Link className="button" to="/admin/events">
              이벤트 감독
            </Link>
          </div>
        </header>

        {error ? (
          <div className="dash-alert">
            <span>{error}</span>
            <Link className="button" to="/login">
              다시 로그인
            </Link>
          </div>
        ) : null}

        <div className="dash-grid">
          {metrics.map((metric) => (
            <article className="dash-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{loading ? "-" : formatCount(metric.value)}</strong>
              <p>{metric.hint}</p>
            </article>
          ))}
        </div>

        <section className="dash-panel">
          <header className="dash-panel-head">
            <h3>운영 바로가기</h3>
            <span className="badge neutral">{loading ? "LOADING" : "LIVE"}</span>
          </header>
          {loading ? (
            <div className="dash-loading">대시보드 메트릭을 불러오는 중...</div>
          ) : (
            <div className="dash-quick">
              <Link className="dash-link" to="/admin/users">
                <strong>사용자 관리</strong>
                <span>계정 상태와 권한을 조정합니다.</span>
              </Link>
              <Link className="dash-link" to="/admin/disputes">
                <strong>분쟁/거래 센터</strong>
                <span>리셀 거래와 신고를 검토합니다.</span>
              </Link>
              <Link className="dash-link" to="/admin/blockchain">
                <strong>블록체인 로그</strong>
                <span>트랜잭션 제출과 실패를 추적합니다.</span>
              </Link>
              <Link className="dash-link" to="/admin/organizer-approvals">
                <strong>주최자 승인</strong>
                <span>주최자 신청을 심사합니다.</span>
              </Link>
            </div>
          )}
        </section>
      </section>
    </>
  );
}
