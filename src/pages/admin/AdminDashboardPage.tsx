import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { AdminDashboardSummary } from "../../types/api";
import { buildAdminError, formatCount } from "./adminUtils";

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
        const [summary, pendingOrganizers, pendingEvents, activeUsers, activeEvents, openDisputes, reviewingDisputes] =
          await Promise.all([
            backendApi.getAdminDashboard(),
            backendApi.getOrganizerApplications({ status: "PENDING", page: 0, size: 1 }),
            backendApi.getAdminEvents({ status: "INACTIVE", page: 0, size: 1 }),
            backendApi.getUsers({ status: "ACTIVE", page: 0, size: 1 }),
            backendApi.getAdminEvents({ status: "PUBLISHED", page: 0, size: 1 }),
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
        setError(buildAdminError(cause, "대시보드 지표를 불러오지 못했습니다."));
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
      hint: "승인 또는 거절 처리가 필요한 신청",
      to: "/admin/organizer-approvals",
    },
    {
      label: "이벤트 검수 대기",
      value: pendingEventCount,
      hint: "검수 또는 운영 전환이 필요한 이벤트",
      to: "/admin/events",
    },
    {
      label: "처리 중인 신고",
      value: pendingDisputeCount,
      hint: "접수 및 검토 중인 분쟁",
      to: "/admin/disputes",
    },
    {
      label: "온체인 처리 실패",
      value: 0,
      hint: "실패 로그는 거래 기록에서 확인",
      to: "/admin/blockchain",
    },
  ];

  const metrics = [
    { label: "활성 회원", value: activeUserCount, hint: "현재 활성 상태의 계정" },
    { label: "운영 중 이벤트", value: activeEventCount, hint: "현재 예매 가능한 이벤트" },
    { label: "판매된 티켓", value: dashboard?.soldTicketCount, hint: "누적 1차 판매 티켓" },
    { label: "사용 완료 티켓", value: dashboard?.usedTicketCount, hint: "체크인 처리된 티켓" },
    { label: "리셀 등록 티켓", value: dashboard?.activeResaleListingCount, hint: "현재 활성 리셀 등록" },
  ];

  return (
    <>
      <section className="work-panel">
        <div className="work-head">
          <div>
            <div className="work-kicker">오늘 확인할 업무</div>
            <div className="work-title">관리자 조치가 필요한 항목을 우선 확인하세요.</div>
            <div className="work-desc">중복 KPI를 줄이고, 실제로 눌러 이동할 업무만 요약했습니다.</div>
          </div>
          <div className="work-date">운영 체크리스트</div>
        </div>

        <div className="todo-list">
          {reviewItems.map((item) => (
            <Link className="todo-row" key={item.label} to={item.to}>
              <div className="todo-num">{loading ? "-" : formatCount(item.value)}</div>
              <div>
                <div className="todo-title">{item.label}</div>
                <div className="todo-sub">{item.hint}</div>
              </div>
              <span className="todo-action">확인</span>
            </Link>
          ))}
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <section className="section">
        <div className="section-head">
          <div>
            <div className="section-title">서비스 운영 지표</div>
            <div className="sub">업무 동선과 겹치지 않는 전체 현황</div>
          </div>
        </div>
        <div className="metrics-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <div className="metric-label">{metric.label}</div>
              <div className="metric-value">{loading ? "-" : formatCount(metric.value)}</div>
              <div className="metric-sub">{metric.hint}</div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
