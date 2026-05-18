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
  const status = getHttpStatus(cause);
  if (status === 401 || status === 403) {
    return "관리자 로그인이 필요합니다. 관리자 계정으로 다시 로그인하세요.";
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
  const [pendingOrganizerCount, setPendingOrganizerCount] = useState<number | undefined>();
  const [flaggedEventCount, setFlaggedEventCount] = useState<number | undefined>();
  const [openDisputeCount, setOpenDisputeCount] = useState<number | undefined>();
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
          setError("관리자 로그인이 필요합니다. 관리자 계정으로 다시 로그인하세요.");
          return;
        }

        const [summary, pendingOrganizers, flaggedEvents, openDisputes, reviewingDisputes] = await Promise.all([
          backendApi.getAdminDashboard(),
          backendApi.getOrganizerApplications({ status: "PENDING", page: 0, size: 1 }),
          backendApi.getAdminEvents({ flagged: true, page: 0, size: 1 }),
          backendApi.getDisputes({ status: "OPEN", page: 0, size: 1 }),
          backendApi.getDisputes({ status: "REVIEWING", page: 0, size: 1 }),
        ]);

        setDashboard(summary);
        setPendingOrganizerCount(pendingOrganizers.totalElements ?? pendingOrganizers.items?.length);
        setFlaggedEventCount(flaggedEvents.totalElements ?? flaggedEvents.items?.length);
        setOpenDisputeCount(
          (openDisputes.totalElements ?? openDisputes.items?.length ?? 0) +
            (reviewingDisputes.totalElements ?? reviewingDisputes.items?.length ?? 0),
        );
      } catch (cause) {
        setDashboard(null);
        setPendingOrganizerCount(undefined);
        setFlaggedEventCount(undefined);
        setOpenDisputeCount(undefined);
        setError(buildError(cause));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const workItems = [
    {
      label: "승인 대기 주최자",
      value: pendingOrganizerCount,
      hint: "신규 주최자 신청",
      to: "/admin/organizer-approvals",
    },
    {
      label: "검토 표시 이벤트",
      value: flaggedEventCount,
      hint: "운영자 확인 필요",
      to: "/admin/events",
    },
    {
      label: "미처리 분쟁",
      value: openDisputeCount,
      hint: "접수/검토중",
      to: "/admin/disputes",
    },
  ];

  const metrics = [
    {
      label: "운영 중인 이벤트",
      value: dashboard?.activeEventCount,
      hint: "현재 활성 상태",
    },
    {
      label: "판매 완료 티켓",
      value: dashboard?.soldTicketCount,
      hint: "1차 구매 또는 리셀을 통해 판매된 티켓 수",
    },
    {
      label: "체크인 완료 티켓",
      value: dashboard?.usedTicketCount,
      hint: "QR 검증 후 입장 처리된 티켓 수",
    },
    {
      label: "판매 중인 리셀",
      value: dashboard?.activeResaleListingCount,
      hint: "현재 리셀 마켓에 등록된 판매 건수",
    },
  ];

  const quickActions = [
    { label: "주최자 승인", to: "/admin/organizer-approvals" },
    { label: "이벤트 감독", to: "/admin/events" },
    { label: "사용자 관리", to: "/admin/users" },
    { label: "분쟁/거래 센터", to: "/admin/disputes" },
    { label: "블록체인 로그", to: "/admin/blockchain" },
  ];

  return (
    <>
      <style>{`
        .dash-page { display: grid; gap: 0.8rem; }
        .dash-hero { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 0.85rem 1rem; box-shadow: var(--shadow); }
        .dash-title .eyebrow { margin: 0; }
        .dash-title h2 { margin: 0.08rem 0 0; font-size: 1.18rem; }
        .dash-title p { margin: 0.28rem 0 0; color: var(--txt-sub); font-size: 0.86rem; line-height: 1.45; }
        .dash-alert { background: #fff5f5; border: 1px solid #ffcdd2; color: #c62828; border-radius: 12px; padding: 0.75rem 1rem; font-weight: 800; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .dash-alert .button { border-color: #ffcdd2; background: #fff; color: #c62828; padding: 0.35rem 0.65rem; }
        .dash-block { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
        .dash-block-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; padding: 0.7rem 0.85rem; border-bottom: 1px solid var(--border); background: #f8fafc; }
        .dash-block-head h3 { margin: 0; font-size: 0.9rem; color: var(--txt-main); }
        .dash-block-head span { color: var(--txt-sub); font-size: 0.76rem; font-weight: 800; }
        .dash-work-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; padding: 0.75rem; }
        .dash-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.65rem; padding: 0.75rem; }
        .dash-card { border: 1px solid var(--border); border-radius: 10px; padding: 0.72rem 0.8rem; min-height: 74px; background: #fff; text-decoration: none; color: inherit; }
        .dash-card span { display: block; color: var(--txt-sub); font-size: 0.74rem; font-weight: 800; }
        .dash-card strong { display: block; margin-top: 0.25rem; font-size: 1.45rem; color: var(--txt-main); font-variant-numeric: tabular-nums; line-height: 1.05; }
        .dash-card p { margin: 0.24rem 0 0; color: var(--txt-sub); font-size: 0.76rem; line-height: 1.35; }
        .dash-work { border-color: #dbeafe; background: #f8fbff; }
        .dash-work:hover { background: #e8f1ff; border-color: #cfe0ff; }
        .dash-actions { display: flex; gap: 0.45rem; flex-wrap: wrap; padding: 0.75rem; }
        .dash-action { border: 1px solid var(--border); border-radius: 9px; padding: 0.52rem 0.7rem; color: var(--txt-main); background: var(--panel-soft); font-weight: 800; text-decoration: none; font-size: 0.8rem; }
        .dash-action:hover { border-color: #cfe0ff; background: #e8f1ff; color: var(--accent-2); }
        @media (max-width: 1000px) {
          .dash-work-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .dash-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .dash-work-grid, .dash-metric-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <section className="dash-page">
        <header className="dash-hero">
          <div className="dash-title">
            <p className="eyebrow">관리자 콘솔</p>
            <h2>관리자 대시보드</h2>
            <p>
              플랫폼 운영 현황을 한눈에 확인하고, 승인·감독·분쟁·블록체인 로그를 관리합니다. 현재 운영 중인 이벤트,
              티켓 판매, 체크인, 리셀 상태를 기준으로 플랫폼 상태를 확인합니다.
            </p>
          </div>
        </header>

        {error ? (
          <div className="dash-alert">
            <span>{error}</span>
            <a className="button" href="/login">
              다시 로그인
            </a>
          </div>
        ) : null}

        <section className="dash-block">
          <div className="dash-block-head">
            <h3>주요 처리 항목</h3>
            <span>바로 확인해야 할 작업</span>
          </div>
          <div className="dash-work-grid">
            {workItems.map((item) => (
              <Link className="dash-card dash-work" key={item.label} to={item.to}>
                <span>{item.label}</span>
                <strong>{loading ? "-" : formatCount(item.value)}</strong>
                <p>{item.hint}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="dash-block">
          <div className="dash-block-head">
            <h3>운영 지표</h3>
            <span>현재 플랫폼 상태</span>
          </div>
          <div className="dash-metric-grid">
            {metrics.map((metric) => (
              <article className="dash-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{loading ? "-" : formatCount(metric.value)}</strong>
                <p>{metric.hint}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dash-block">
          <div className="dash-block-head">
            <h3>빠른 작업</h3>
            <span>관리 메뉴 이동</span>
          </div>
          <div className="dash-actions">
            {quickActions.map((item) => (
              <Link className="dash-action" key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
