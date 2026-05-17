import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { backendApi } from "../lib/backend";
import type {
  BlockchainTransactionRecord,
  CheckInRecord,
  EventDetail,
  OrganizerApplication,
  TicketDetail,
  UserAdminRecord,
  UserProfile,
} from "../types/api";
import { LandingPage as BaseLandingPage } from "./LandingPage";
import { LoginPage } from "./LoginPage";
import { AdminBlockchainLogPage as BaseAdminBlockchainLogPage } from "./admin/AdminBlockchainLogPage";
import { AdminDashboardPage as BaseAdminDashboardPage } from "./admin/AdminDashboardPage";
import { AdminDisputeTransactionPage as BaseAdminDisputeTransactionPage } from "./admin/AdminDisputeTransactionPage";
import { AdminEventsPage as BaseAdminEventsPage } from "./admin/AdminEventsPage";
import { AdminUserManagePage as BaseAdminUserManagePage } from "./admin/AdminUserManagePage";
import { OrganizerApprovalsPage as BaseOrganizerApprovalsPage } from "./admin/OrganizerApprovalsPage";
import { EventCreatePage as BaseEventCreatePage } from "./organizer/EventCreatePage";
import { MyEventsPage as BaseMyEventsPage } from "./organizer/MyEventsPage";
import { OrganizerDashboardPage as BaseOrganizerDashboardPage } from "./organizer/OrganizerDashboardPage";
import { EventDetailPage as BaseEventDetailPage } from "./user/EventDetailPage";
import { MyPage as BaseMyTicketPage } from "./user/MyPage";
import { ResaleDetailPage as BaseResaleDetailPage } from "./user/ResaleDetailPage";
import { ResaleListPage as BaseResaleListPage } from "./user/ResaleListPage";
import { TicketDetailPage as BaseTicketDetailPage } from "./user/TicketDetailPage";
import { UserHomePage as BaseUserHomePage } from "./user/UserHomePage";

function Panel({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {description ? <p className="lead">{description}</p> : null}
      {actions ? <div className="action-row">{actions}</div> : null}
      {children}
    </section>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="code">{JSON.stringify(value, null, 2)}</pre>;
}

function useAsyncValue<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loader()
      .then((result) => {
        if (active) {
          setValue(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Failed to load data");
        }
      });
    return () => {
      active = false;
    };
  }, deps);

  return { value, setValue, error, setError };
}

export const UserLandingPage = BaseLandingPage;
export const OrganizerLandingPage = BaseLandingPage;

export function UserAuthPage() {
  return (
    <Panel
      title="로그인 / 회원가입"
      description="이메일 또는 지갑 인증으로 사용자와 주최자 계정을 하나의 공통 진입점에서 시작합니다."
      actions={
        <>
          <Link className="button primary" to="/login">
            로그인
          </Link>
          <Link className="button" to="/register">
            회원가입
          </Link>
        </>
      }
    >
      <p className="lead">
        로그인 후 roles를 확인해 사용자, 주최자, 관리자 섹션으로 자동 이동합니다.
      </p>
    </Panel>
  );
}

export const OrganizerAuthPage = UserAuthPage;
export const AdminLoginPage = LoginPage;
export const UserHomePage = BaseUserHomePage;
export const EventListPage = BaseUserHomePage;
export const EventDetailPage = BaseEventDetailPage;
export const ResaleListPage = BaseResaleListPage;
export const ResaleDetailPage = BaseResaleDetailPage;
export const MyTicketListPage = BaseMyTicketPage;
export const TicketDetailPage = BaseTicketDetailPage;
export const OrganizerDashboardPage = BaseOrganizerDashboardPage;
export const EventCreatePage = BaseEventCreatePage;
export const OrganizerEventListPage = BaseMyEventsPage;
export const AdminDashboardPage = BaseAdminDashboardPage;
export const OrganizerApprovalPage = BaseOrganizerApprovalsPage;
export const AdminUserManagePage = BaseAdminUserManagePage;
export const AdminDisputeTransactionPage = BaseAdminDisputeTransactionPage;
export const AdminEventManagePage = BaseAdminEventsPage;
export const AdminBlockchainLogPage = BaseAdminBlockchainLogPage;

export function UserMyPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void backendApi.getMe().then((data) => {
      setProfile(data);
      setDisplayName(data.displayName ?? "");
    });
    void backendApi.getMyTickets().then(setTickets);
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const updated = await backendApi.updateMe({ displayName });
    setProfile(updated);
    setMessage("프로필을 저장했습니다.");
  }

  return (
    <Panel
      title="마이페이지"
      description="프로필 정보와 보유 티켓을 함께 확인합니다."
      actions={
        <>
          <Link className="button" to="/app/tickets">
            티켓 목록
          </Link>
          <Link className="button" to="/app/resale">
            리셀 마켓
          </Link>
        </>
      }
    >
      <form className="form" onSubmit={onSave}>
        <input value={profile?.email ?? ""} disabled placeholder="이메일" />
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="표시 이름"
        />
        <button className="button primary" type="submit">
          프로필 저장
        </button>
      </form>
      {message ? <p>{message}</p> : null}
      <div className="card-grid">
        {tickets.map((ticket) => (
          <Link key={ticket.ticketId} className="event-card" to={`/app/tickets/${ticket.ticketId}`}>
            <h3>{ticket.eventName}</h3>
            <p>{ticket.seatInfo}</p>
            <p>{ticket.status}</p>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export function TicketPurchasePage() {
  const { ticketId = "" } = useParams();
  const navigate = useNavigate();
  const { value: ticket } = useAsyncValue(async () => backendApi.getTicket(ticketId), [ticketId]);
  const [validity, setValidity] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ticketId) {
      return;
    }
    void backendApi.getTicketValidity(ticketId).then(setValidity);
  }, [ticketId]);

  async function onPurchase() {
    const result = await backendApi.purchasePrimary(ticketId);
    navigate(`/app/purchase-complete?ticketId=${encodeURIComponent(String(result.ticketId ?? ticketId))}`);
    setMessage("예매 요청을 전송했습니다.");
  }

  return (
    <Panel title="티켓 예매" description="1차 판매 티켓을 예매합니다.">
      <JsonBlock value={ticket} />
      <JsonBlock value={validity} />
      <div className="action-row">
        <button className="button primary" onClick={() => void onPurchase()}>
          구매하기
        </button>
      </div>
      {message ? <p>{message}</p> : null}
    </Panel>
  );
}

export function PurchaseCompletePage() {
  const [params] = useSearchParams();
  return (
    <Panel
      title="예매/재판매 확인"
      description="구매가 완료된 후 보여주는 확인 화면입니다."
      actions={
        <>
          <Link className="button primary" to="/app/me">
            마이페이지
          </Link>
          <Link className="button" to="/app">
            메인으로 이동
          </Link>
        </>
      }
    >
      <JsonBlock
        value={{
          ticketId: params.get("ticketId"),
          listingId: params.get("listingId"),
          txHash: params.get("txHash"),
        }}
      />
    </Panel>
  );
}

export function TicketResaleCreatePage() {
  const { ticketId = "" } = useParams();
  const navigate = useNavigate();
  const [priceWei, setPriceWei] = useState("100000000000000000");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await backendApi.createResale(ticketId, priceWei);
    navigate(`/app/resale-complete?listingId=${encodeURIComponent(result.listingId)}`);
    setMessage("리셀 등록 요청을 보냈습니다.");
  }

  return (
    <Panel title="티켓 판매" description="판매 가격을 입력하고 리셀 등록을 진행합니다.">
      <form className="form" onSubmit={onSubmit}>
        <input value={priceWei} onChange={(event) => setPriceWei(event.target.value)} />
        <button className="button primary" type="submit">
          판매 등록
        </button>
      </form>
      {message ? <p>{message}</p> : null}
    </Panel>
  );
}

export function ResaleRegisterCompletePage() {
  const [params] = useSearchParams();
  return (
    <Panel
      title="판매 등록 완료"
      description="리셀 등록 성공 후 이동하는 결과 화면입니다."
      actions={
        <>
          <Link className="button primary" to="/app/tickets">
            내 티켓 보기
          </Link>
          <Link className="button" to="/app">
            메인으로 이동
          </Link>
        </>
      }
    >
      <JsonBlock value={{ listingId: params.get("listingId"), status: "REGISTERED" }} />
    </Panel>
  );
}

export function TicketQrPage() {
  const { ticketId = "" } = useParams();
  const [claimedOwner, setClaimedOwner] = useState("");
  const [expiresAt, setExpiresAt] = useState(new Date(Date.now() + 10 * 60_000).toISOString());
  const [signature, setSignature] = useState("");
  const [qrData, setQrData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void backendApi.getTicket(ticketId).then((ticket) => {
      setClaimedOwner(ticket.eventId);
    });
  }, [ticketId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await backendApi.createTicketQr(ticketId, { claimedOwner, expiresAt, signature });
    setQrData(result);
  }

  return (
    <Panel title="QR / 바코드 표시" description="입장용 QR 이미지와 서명 데이터를 생성합니다.">
      <form className="form" onSubmit={onCreate}>
        <input value={claimedOwner} onChange={(event) => setClaimedOwner(event.target.value)} placeholder="소유자" />
        <input value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} placeholder="만료 시각" />
        <input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="서명" />
        <button className="button primary" type="submit">
          QR 생성
        </button>
      </form>
      <JsonBlock value={qrData} />
    </Panel>
  );
}

export function OrganizerEventDetailPage() {
  const { eventId = "" } = useParams();
  const eventState = useAsyncValue(async () => backendApi.getEvent(eventId), [eventId]);
  const ticketsState = useAsyncValue(async () => backendApi.getEventTickets(eventId), [eventId]);
  const validatorsState = useAsyncValue(async () => backendApi.getEventValidators(eventId), [eventId]);

  const stats = useMemo(
    () => ({
      totalTicketCount: eventState.value?.totalTicketCount,
      soldTicketCount: eventState.value?.soldTicketCount,
      remainingTicketCount: eventState.value?.remainingTicketCount,
      resaleCount: eventState.value?.resaleCount,
      checkInCount: eventState.value?.checkInCount,
    }),
    [eventState.value],
  );

  return (
    <Panel
      title="이벤트 관리 상세"
      description="이벤트 정보, 티켓, 검증자, 체크인 현황을 확인합니다."
      actions={
        <>
          <Link className="button" to={`/organizer/events/${eventId}/settings`}>
            이벤트 설정
          </Link>
          <Link className="button" to={`/organizer/events/${eventId}/sales`}>
            판매 현황
          </Link>
          <Link className="button" to={`/organizer/events/${eventId}/checkins`}>
            체크인 관리
          </Link>
        </>
      }
    >
      <JsonBlock value={eventState.value} />
      <JsonBlock value={stats} />
      <JsonBlock value={ticketsState.value} />
      <JsonBlock value={validatorsState.value} />
    </Panel>
  );
}

export function EventSettingsPage() {
  const { eventId = "" } = useParams();
  const eventState = useAsyncValue(async () => backendApi.getEvent(eventId), [eventId]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [resaleAllowed, setResaleAllowed] = useState(true);
  const [maxResalePriceRate, setMaxResalePriceRate] = useState(12000);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!eventState.value) {
      return;
    }
    setName(eventState.value.name ?? eventState.value.title ?? "");
    setCategory(eventState.value.category ?? "");
    setVenue(eventState.value.venue ?? eventState.value.venueDetail ?? "");
    setDescription(eventState.value.description ?? "");
    setImageUrl(eventState.value.imageUrl ?? "");
  }, [eventState.value]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    await backendApi.updateEvent(eventId, { name, category, venue, description, imageUrl });
    await backendApi.updateEventStatus(eventId, { status });
    await backendApi.updateResalePolicy(eventId, {
      resaleAllowed,
      maxResalePriceRate,
      resaleStart: null,
      resaleEnd: null,
    });
    setMessage("이벤트 설정을 저장했습니다.");
  }

  return (
    <Panel title="이벤트 설정" description="기본 정보와 리셀 정책을 수정합니다.">
      <form className="form" onSubmit={onSave}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="이벤트명" />
        <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="카테고리" />
        <input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="장소" />
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="설명" />
        <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="이미지 URL" />
        <input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="상태" />
        <input
          value={String(resaleAllowed)}
          onChange={(event) => setResaleAllowed(event.target.value === "true")}
          placeholder="리셀 허용"
        />
        <input
          value={String(maxResalePriceRate)}
          onChange={(event) => setMaxResalePriceRate(Number(event.target.value))}
          placeholder="최대 리셀 비율"
        />
        <button className="button primary" type="submit">
          저장
        </button>
      </form>
      {message ? <p>{message}</p> : null}
      <JsonBlock value={eventState.value} />
    </Panel>
  );
}

export function SalesStatusPage() {
  const { eventId = "" } = useParams();
  const eventState = useAsyncValue(async () => backendApi.getEvent(eventId), [eventId]);
  const ticketsState = useAsyncValue(async () => backendApi.getEventTickets(eventId), [eventId]);

  return (
    <Panel title="판매 현황 조회" description="판매 수량, 리셀 수, 체크인 수를 요약합니다.">
      <JsonBlock value={eventState.value} />
      <JsonBlock value={ticketsState.value} />
    </Panel>
  );
}

export function CheckInManagePage() {
  const { eventId = "" } = useParams();
  const [ticketId, setTicketId] = useState("");
  const [claimedOwner, setClaimedOwner] = useState("");
  const [expiresAt, setExpiresAt] = useState(new Date(Date.now() + 10 * 60_000).toISOString());
  const [signature, setSignature] = useState("");
  const [memo, setMemo] = useState("");
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await backendApi.checkIn({ ticketId, claimedOwner, expiresAt, signature, memo });
    setMessage("체크인을 처리했습니다.");
    if (ticketId) {
      setHistory(await backendApi.getTicketCheckIns(ticketId));
    }
  }

  return (
    <Panel title="체크인 관리" description="QR 또는 서명 메시지로 입장 처리를 수행합니다.">
      <form className="form" onSubmit={onSubmit}>
        <input value={ticketId} onChange={(event) => setTicketId(event.target.value)} placeholder="티켓 ID" />
        <input value={claimedOwner} onChange={(event) => setClaimedOwner(event.target.value)} placeholder="소유자" />
        <input value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} placeholder="만료 시각" />
        <input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="서명" />
        <input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="메모" />
        <button className="button primary" type="submit">
          입장 처리
        </button>
      </form>
      {message ? <p>{message}</p> : null}
      <JsonBlock value={{ eventId, history }} />
    </Panel>
  );
}

export function OrganizerProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [applications, setApplications] = useState<OrganizerApplication[]>([]);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    void backendApi.getMe().then((data) => {
      setProfile(data);
      setDisplayName(data.displayName ?? "");
    });
    void backendApi.getMyOrganizerApplications().then(setApplications);
  }, []);

  return (
    <Panel title="내정보" description="주최자 프로필과 신청 이력을 확인합니다.">
      <JsonBlock value={profile} />
      <JsonBlock value={applications} />
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault();
          setProfile(await backendApi.updateMe({ displayName }));
        }}
      >
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="표시 이름" />
        <button className="button primary" type="submit">
          저장
        </button>
      </form>
    </Panel>
  );
}

export function LegacyAdminEventManagePage() {
  const [items, setItems] = useState<EventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "CANCELLED" | "ENDED">("ALL");
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await backendApi.getAdminEvents({
        query: query || undefined,
        status: filterStatus !== "ALL" ? filterStatus : undefined,
      });
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filterStatus]);

  async function handleFlag(eventId: string, currentlyFlagged: boolean) {
    setFlaggingId(eventId);
    try {
      if (currentlyFlagged) {
        await backendApi.unflagAdminEvent(eventId);
        setActionMessage("플래그를 해제했습니다.");
      } else {
        await backendApi.flagAdminEvent(eventId);
        setActionMessage("이벤트에 플래그를 설정했습니다.");
      }
      await load();
    } finally {
      setFlaggingId(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  }

  const STATUS_LABEL: Record<string, string> = {
    ACTIVE: "진행중", CANCELLED: "취소됨", ENDED: "종료됨", PENDING: "대기중", FLAGGED: "플래그",
  };

  const filterTabs = [
    { label: "전체", value: "ALL" as const },
    { label: "진행중", value: "ACTIVE" as const },
    { label: "종료됨", value: "ENDED" as const },
    { label: "취소됨", value: "CANCELLED" as const },
  ];

  return (
    <>
      <style>{`
        .ev-page { display: grid; gap: 1rem; }
        .ev-header { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 1.2rem 1.4rem; box-shadow: var(--shadow); }
        .ev-toprow { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .ev-title-group { display: grid; gap: 0.2rem; }
        .ev-title-group .eyebrow { margin: 0; }
        .ev-title-group h2 { margin: 0; font-size: 1.4rem; }
        .ev-search-form { display: flex; gap: 0.5rem; align-items: center; }
        .ev-search-input { border-radius: 10px; border: 1px solid var(--border-strong); padding: 0.5rem 0.75rem; font-size: 0.9rem; width: 220px; color: var(--txt-main); background: #fff; }
        .ev-search-input::placeholder { color: #8a97a8; }
        .ev-search-btn { border: 1px solid var(--border); background: var(--panel); color: var(--txt-main); border-radius: 10px; padding: 0.5rem 0.85rem; cursor: pointer; font-size: 0.9rem; font-weight: 600; }
        .ev-search-btn:hover { background: var(--bg-1); }
        .ev-filter-tabs { display: flex; gap: 0.4rem; margin-top: 1rem; flex-wrap: wrap; }
        .ev-filter-tab { border: 1px solid var(--border); background: var(--panel-soft); color: var(--txt-sub); border-radius: 999px; padding: 0.38rem 0.9rem; font-size: 0.83rem; font-weight: 600; cursor: pointer; }
        .ev-filter-tab:hover { background: var(--bg-1); color: var(--txt-main); }
        .ev-filter-tab.active { background: linear-gradient(135deg, #eaf2ff, #f0f6ff); border-color: #cfe0ff; color: var(--accent-2); }
        .ev-toast { background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; border-radius: 10px; padding: 0.6rem 1rem; font-size: 0.88rem; font-weight: 600; margin-top: 0.75rem; }
        .ev-table-shell { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
        .ev-table-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, #fff, #f7f9fc); }
        .ev-table-head h3 { margin: 0; font-size: 0.95rem; font-weight: 700; }
        .ev-count-badge { background: #e8f1ff; color: var(--accent-2); border-radius: 999px; padding: 0.28rem 0.7rem; font-size: 0.78rem; font-weight: 700; }
        .ev-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
        .ev-table thead tr { background: #f8fafc; border-bottom: 1px solid var(--border); }
        .ev-table th { padding: 0.7rem 1rem; text-align: left; font-size: 0.78rem; font-weight: 700; color: var(--txt-sub); letter-spacing: 0.04em; white-space: nowrap; }
        .ev-table td { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--txt-main); }
        .ev-table tbody tr:last-child td { border-bottom: 0; }
        .ev-table tbody tr:hover { background: #fafcff; }
        .ev-id { font-family: "Courier New", monospace; font-size: 0.78rem; color: var(--txt-sub); white-space: nowrap; }
        .ev-name { font-weight: 600; }
        .ev-venue { font-weight: 400; font-size: 0.8rem; color: var(--txt-sub); margin-top: 0.15rem; }
        .ev-organizer { color: var(--txt-sub); font-size: 0.85rem; }
        .ev-status { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.28rem 0.65rem; font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
        .ev-status.active { background: #e8f5e9; color: #2e7d32; }
        .ev-status.ended { background: #f3f3f3; color: #555; }
        .ev-status.cancelled { background: #fff3e0; color: #e65100; }
        .ev-status.pending { background: #e8f1ff; color: var(--accent-2); }
        .ev-status.flagged { background: #fce4ec; color: #c62828; }
        .ev-flag-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #ef5350; margin-right: 5px; vertical-align: middle; }
        .ev-tickets { text-align: right; font-variant-numeric: tabular-nums; }
        .ev-tickets-sold { font-weight: 700; }
        .ev-tickets-total { color: var(--txt-sub); font-size: 0.82rem; }
        .ev-flag-btn { border: 1px solid #ffcdd2; background: #fff5f5; color: #c62828; border-radius: 8px; padding: 0.38rem 0.75rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
        .ev-flag-btn:hover { background: #ffebee; }
        .ev-flag-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ev-unflag-btn { border: 1px solid var(--border); background: var(--panel-soft); color: var(--txt-sub); border-radius: 8px; padding: 0.38rem 0.75rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
        .ev-unflag-btn:hover { background: var(--bg-1); }
        .ev-unflag-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ev-empty { text-align: center; padding: 3rem 1rem; color: var(--txt-sub); }
        .ev-loading td { text-align: center; padding: 3rem; color: var(--txt-sub); }
      `}</style>

      <div className="ev-page">
        <div className="ev-header">
          <div className="ev-toprow">
            <div className="ev-title-group">
              <p className="eyebrow">이벤트 관리</p>
              <h2>이벤트 감독</h2>
            </div>
            <form className="ev-search-form" onSubmit={(e) => { e.preventDefault(); void load(); }}>
              <input
                className="ev-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이벤트명 또는 주최자 검색"
              />
              <button className="ev-search-btn" type="submit">검색</button>
            </form>
          </div>
          <div className="ev-filter-tabs">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                className={`ev-filter-tab${filterStatus === tab.value ? " active" : ""}`}
                onClick={() => setFilterStatus(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {actionMessage && <div className="ev-toast">{actionMessage}</div>}
        </div>

        <div className="ev-table-shell">
          <div className="ev-table-head">
            <h3>전체 이벤트 목록</h3>
            <span className="ev-count-badge">{items.length}건</span>
          </div>
          {items.length === 0 && !loading ? (
            <div className="ev-empty"><p>조건에 맞는 이벤트가 없습니다.</p></div>
          ) : (
            <table className="ev-table">
              <thead>
                <tr>
                  <th>이벤트 ID</th>
                  <th>이벤트명 / 장소</th>
                  <th>주최자</th>
                  <th>판매 현황</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="ev-loading"><td colSpan={6}>불러오는 중...</td></tr>
                ) : (
                  items.map((event) => {
                    const isFlagged = (event as any).flagged === true;
                    const rawStatus = event.status ?? "ACTIVE";
                    const statusKey = isFlagged ? "flagged" : rawStatus.toLowerCase();
                    return (
                      <tr key={event.id}>
                        <td className="ev-id">#{String(event.id).slice(0, 8)}</td>
                        <td>
                          <div className="ev-name">{event.title ?? (event as any).name}</div>
                          <div className="ev-venue">{event.venue ?? (event as any).venueDetail ?? "-"}</div>
                        </td>
                        <td className="ev-organizer">
                          {(event as any).organizerName ?? (event as any).organizer ?? "-"}
                        </td>
                        <td className="ev-tickets">
                          <span className="ev-tickets-sold">{event.soldTicketCount ?? "-"}</span>
                          <span className="ev-tickets-total"> / {event.totalTicketCount ?? "-"}</span>
                        </td>
                        <td>
                          <span className={`ev-status ${statusKey}`}>
                            {isFlagged && <span className="ev-flag-dot" />}
                            {STATUS_LABEL[isFlagged ? "FLAGGED" : rawStatus] ?? rawStatus}
                          </span>
                        </td>
                        <td>
                          {isFlagged ? (
                            <button className="ev-unflag-btn" disabled={flaggingId === event.id} onClick={() => void handleFlag(event.id, true)}>
                              {flaggingId === event.id ? "처리중..." : "플래그 해제"}
                            </button>
                          ) : (
                            <button className="ev-flag-btn" disabled={flaggingId === event.id} onClick={() => void handleFlag(event.id, false)}>
                              {flaggingId === event.id ? "처리중..." : "플래그"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

export function LegacyAdminUserManagePage() {
  const [items, setItems] = useState<UserAdminRecord[]>([]);

  async function load() {
    const data = await backendApi.getUsers();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Panel title="사용자 관리" description="사용자 목록과 정지/활성화/삭제/검증자 권한을 제어합니다.">
      <div className="card-grid">
        {items.map((user) => (
          <article key={user.id} className="event-card">
            <h3>{user.displayName ?? user.email ?? user.id}</h3>
            <p>{user.roles.join(", ")}</p>
            <p>{user.status}</p>
            <div className="action-row">
              <button className="button" onClick={() => void backendApi.suspendUser(user.id).then(load)}>
                정지
              </button>
              <button className="button primary" onClick={() => void backendApi.activateUser(user.id).then(load)}>
                활성화
              </button>
              <button className="button" onClick={() => void backendApi.deleteUser(user.id).then(load)}>
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function LegacyAdminBlockchainLogPage() {
  const [items, setItems] = useState<BlockchainTransactionRecord[]>([]);

  useEffect(() => {
    void backendApi.getBlockchainTransactions().then(setItems);
  }, []);

  return (
    <Panel title="블록체인 트랜잭션 모니터링" description="온체인 트랜잭션 상태와 실패 로그를 확인합니다.">
      <div className="card-grid">
        {items.map((item, index) => (
          <article key={item.id ?? `${index}`} className="event-card">
            <JsonBlock value={item} />
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function LegacyAdminDisputeTransactionPage() {
  const disputes = useAsyncValue(async () => backendApi.getDisputes(), []);
  const resaleTransactions = useAsyncValue(async () => backendApi.getResaleTransactions(), []);
  const [reviewNote, setReviewNote] = useState("");

  async function review(disputeId: string, status: string) {
    await backendApi.reviewDispute(disputeId, { status, resolutionNote: reviewNote });
    disputes.setValue(await backendApi.getDisputes());
  }

  return (
    <Panel title="거래 / 분쟁 관리" description="리셀 거래와 분쟁 신고를 함께 검토합니다.">
      <input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="resolution note" />
      <JsonBlock value={resaleTransactions.value} />
      <div className="card-grid">
        {disputes.value?.items?.map((item) => (
          <article key={(item.id as string) ?? JSON.stringify(item)} className="event-card">
            <JsonBlock value={item} />
            {(item.id as string | undefined) ? (
              <div className="action-row">
                <button className="button primary" onClick={() => void review(item.id as string, "APPROVED")}>
                  승인
                </button>
                <button className="button" onClick={() => void review(item.id as string, "REJECTED")}>
                  반려
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function TicketIssuePage() {
  const { eventId = "" } = useParams();
  const [seatInfo, setSeatInfo] = useState("");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await backendApi.issueTickets(eventId, {
      seatInfos: seatInfo
        .split(",")
        .map((seat) => seat.trim())
        .filter(Boolean),
    });
    setMessage(`발행 완료: ${result.length}장`);
  }

  return (
    <Panel title="티켓 발행" description="생성된 이벤트에 좌석 정보를 기반으로 티켓을 발행합니다.">
      <form className="form" onSubmit={onSubmit}>
        <input value={seatInfo} onChange={(event) => setSeatInfo(event.target.value)} placeholder="seats" />
        <input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="memo" />
        <button className="button primary" type="submit">
          발행
        </button>
      </form>
      {message ? <p>{message}</p> : null}
    </Panel>
  );
}

export function TicketPurchaseOrCompletePage() {
  return <PurchaseCompletePage />;
}
