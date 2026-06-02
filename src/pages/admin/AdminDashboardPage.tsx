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
    return "관리자 로그인이 필요합니다. 관리자 계정으로 다시 로그인해주세요.";
  }
  const serverMessage = (cause as { response?: { data?: { message?: string } } } | undefined)?.response?.data?.message;
  if (serverMessage) {
    return serverMessage;
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return "대시보드 지표를 불러오지 못했습니다.";
}

function isAuthError(message: string) {
  return message.includes("관리자 로그인이 필요합니다");
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
  const [pendingEventCount, setPendingEventCount] = useState<number | undefined>();
  const [pendingDisputeCount, setPendingDisputeCount] = useState<number | undefined>();
  const [activeUserCount, setActiveUserCount] = useState<number | undefined>();
  const [activeEventCount, setActiveEventCount] = useState<number | undefined>();
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
          setError("관리자 로그인이 필요합니다. 관리자 계정으로 다시 로그인해주세요.");
          return;
        }

        const [summary, pendingOrganizers, pendingEvents, activeUsers, activeEvents, openDisputes, reviewingDisputes] =
          await Promise.all([
            backendApi.getAdminDashboard(),
            backendApi.getOrganizerApplications({ status: "PENDING", page: 0, size: 1 }),
            backendApi.getAdminEvents({ status: "INACTIVE", page: 0, size: 1 }),
            backendApi.getUsers({ status: "ACTIVE", page: 0, size: 1 }),
            backendApi.getAdminEvents({ status: "ACTIVE", page: 0, size: 1 }),
            backendApi.getDisputes({ status: "OPEN", page: 0, size: 1 }),
            backendApi.getDisputes({ status: "REVIEWING", page: 0, size: 1 }),
          ]);

        setDashboard(summary);
        setPendingOrganizerCount(pendingOrganizers.totalElements ?? pendingOrganizers.items?.length);
        setPendingEventCount(summary.pendingEventCount ?? pendingEvents.totalElements ?? pendingEvents.items?.length);
        setActiveUserCount(summary.activeUserCount ?? activeUsers.totalElements ?? activeUsers.items?.length);
        setActiveEventCount(summary.activeEventCount ?? activeEvents.totalElements ?? activeEvents.items?.length);
        setPendingDisputeCount(
          summary.processingDisputeCount ??
            (openDisputes.totalElements ?? openDisputes.items?.length ?? 0) +
              (reviewingDisputes.totalElements ?? reviewingDisputes.items?.length ?? 0),
        );
      } catch (cause) {
        setDashboard(null);
        setPendingOrganizerCount(undefined);
        setPendingEventCount(undefined);
        setPendingDisputeCount(undefined);
        setActiveUserCount(undefined);
        setActiveEventCount(undefined);
        setError(buildError(cause));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const reviewItems = [
    {
      label: "주최자 승인 대기",
      value: pendingOrganizerCount,
      hint: "관리자 승인이 필요한 신청",
      to: "/admin/organizer-approvals",
    },
    {
      label: "이벤트 등록 대기",
      value: pendingEventCount,
      hint: "검토 후 운영 전환이 필요한 이벤트",
      to: "/admin/events",
    },
    {
      label: "분쟁 대기",
      value: pendingDisputeCount,
      hint: "접수 및 검토 중인 분쟁",
      to: "/admin/disputes",
    },
  ];

  const metrics = [
    {
      label: "활성 사용자 수",
      value: activeUserCount,
      hint: "현재 활성 상태의 계정",
    },
    {
      label: "운영중인 이벤트 수",
      value: activeEventCount,
      hint: "현재 운영 가능한 이벤트",
    },
    {
      label: "판매중인 티켓 수",
      value: dashboard?.activeTicketCount,
      hint: "현재 백엔드 집계 API 연동 필요",
    },
    {
      label: "리셀 중인 티켓 수",
      value: dashboard?.activeResaleListingCount,
      hint: "현재 등록된 활성 리셀",
    },
    {
      label: "처리 중인 분쟁 수",
      value: pendingDisputeCount,
      hint: "접수 및 검토 중인 분쟁",
    },
  ];

  return (
    <>
      <style>{`
        .dash-page { display: grid; gap: 0.9rem; }
        .dash-hero { background: var(--panel); border: 1px solid #dbe3ef; border-radius: 14px; padding: 0.85rem 1rem; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06); }
        .dash-title .eyebrow { margin: 0; }
        .dash-title h2 { margin: 0.04rem 0 0; font-size: 1.12rem; }
        .dash-title p { margin: 0.22rem 0 0; color: var(--txt-sub); font-size: 0.84rem; line-height: 1.4; max-width: 640px; }
        .dash-alert { background: #fff5f5; border: 1px solid #ffcdd2; color: #c62828; border-radius: 12px; padding: 0.75rem 1rem; font-weight: 800; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .dash-alert .button { border-color: #ffcdd2; background: #fff; color: #c62828; padding: 0.35rem 0.65rem; }
        .dash-block { background: var(--panel); border: 1px solid #dbe3ef; border-radius: 16px; box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06); overflow: hidden; }
        .dash-block-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; padding: 0.8rem 0.95rem; border-bottom: 1px solid #e5ebf3; background: #f8fafc; }
        .dash-block-head h3 { margin: 0; font-size: 0.92rem; color: var(--txt-main); }
        .dash-block-head span { color: var(--txt-sub); font-size: 0.76rem; font-weight: 800; }
        .dash-work-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; padding: 0.85rem; }
        .dash-metric-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.75rem; padding: 0.85rem; }
        .dash-card { border: 1px solid #dbe3ef; border-radius: 12px; padding: 0.78rem 0.85rem; min-height: 78px; background: #fff; text-decoration: none; color: inherit; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.035); }
        .dash-card span { display: block; color: var(--txt-sub); font-size: 0.74rem; font-weight: 800; }
        .dash-card strong { display: block; margin-top: 0.26rem; font-size: 1.48rem; color: var(--txt-main); font-variant-numeric: tabular-nums; line-height: 1.05; }
        .dash-card p { margin: 0.26rem 0 0; color: var(--txt-sub); font-size: 0.76rem; line-height: 1.35; }
        .dash-work { border-color: #cfe0ff; background: #f8fbff; }
        .dash-work:hover { background: #e8f1ff; border-color: #b8d1ff; }
        @media (max-width: 1100px) {
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
            <p>승인, 이벤트 검토, 분쟁 처리처럼 바로 확인해야 하는 운영 지표를 먼저 보여줍니다.</p>
          </div>
        </header>

        {error ? (
          <div className="dash-alert">
            <span>{error}</span>
            {isAuthError(error) ? (
              <a className="button" href="/login">
                다시 로그인
              </a>
            ) : null}
          </div>
        ) : null}

        <section className="dash-block">
          <div className="dash-block-head">
            <h3>대기/검토 지표</h3>
            <span>바로 확인해야 하는 항목</span>
          </div>
          <div className="dash-work-grid">
            {reviewItems.map((item) => (
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
            <span>현재 서비스 상태</span>
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
      </section>
    </>
  );
}
