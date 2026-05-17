# Trust Ticket Frontend

Trust Ticket frontend is organized around three role-specific experiences: user, organizer, and admin. The current implementation connects those screens to the backend API and blockchain client.

## System Architecture

### User Flow

- Public entry: landing, login, register
- Auth: email login/register, wallet nonce/login
- Discovery: home, event list, event detail, resale list/detail
- Purchase: primary ticket purchase, purchase complete screen
- Ticket ownership: my page, ticket list, ticket detail, QR display, resale registration, resale completion

### Organizer Flow

- Public entry: landing, auth
- Main workspace: organizer dashboard
- Event operations: create event, list own events, event detail
- Event management: settings, sales status, check-in management, ticket issue
- Profile: organizer profile and application history

### Admin Flow

- Public entry: admin login
- Main workspace: admin dashboard
- Governance: organizer approvals, event management, user management
- Risk and disputes: resale transactions, disputes review
- Blockchain monitoring: transaction log viewer

## Route Map

| Role | Page | Route | Status |
| --- | --- | --- | --- |
| Public | Landing page | `/` | Implemented |
| Public | Login | `/login` | Implemented |
| Public | Register | `/register` | Implemented |
| User | User landing | `/app` | Implemented |
| User | User auth | `/app/auth` | Implemented |
| User | Home | `/app/home` | Implemented |
| User | Event list | `/app/events` | Implemented |
| User | Event detail | `/app/events/:eventId` | Implemented |
| User | Primary purchase | `/app/tickets/:ticketId/purchase` | Implemented |
| User | Purchase complete | `/app/purchase-complete` | Implemented |
| User | Resale list | `/app/resale` | Implemented |
| User | Resale detail | `/app/resale/:listingId` | Implemented |
| User | My page | `/app/me` | Implemented |
| User | Ticket list | `/app/tickets` | Implemented |
| User | Ticket detail | `/app/tickets/:ticketId` | Implemented |
| User | Resale registration | `/app/tickets/:ticketId/resale` | Implemented |
| User | Resale completion | `/app/resale-complete` | Implemented |
| User | QR display | `/app/tickets/:ticketId/qr` | Implemented |
| Organizer | Landing | `/organizer/start` | Implemented |
| Organizer | Auth | `/organizer/auth` | Implemented |
| Organizer | Dashboard | `/organizer` | Implemented |
| Organizer | Event create | `/organizer/events/new` | Implemented |
| Organizer | Own event list | `/organizer/events` | Implemented |
| Organizer | Event detail | `/organizer/events/:eventId` | Implemented |
| Organizer | Event settings | `/organizer/events/:eventId/settings` | Implemented |
| Organizer | Sales status | `/organizer/events/:eventId/sales` | Implemented |
| Organizer | Check-in management | `/organizer/events/:eventId/checkins` | Implemented |
| Organizer | Ticket issue | `/organizer/events/:eventId/tickets/issue` | Implemented |
| Organizer | Profile | `/organizer/me` | Implemented |
| Admin | Login | `/admin/login` | Implemented |
| Admin | Dashboard | `/admin` | Implemented |
| Admin | Organizer approvals | `/admin/organizer-approvals` | Implemented |
| Admin | Event management | `/admin/events` | Implemented |
| Admin | User management | `/admin/users` | Implemented |
| Admin | Dispute management | `/admin/disputes` | Implemented |
| Admin | Blockchain log | `/admin/blockchain` | Implemented |

## Page-by-Page Implementation Check

The table below is based on `src/pages/portalPages.tsx`, `src/routes.tsx`, and the supporting API client. "Implemented" means the page exists, is routed, and already calls the backend or blockchain client. "Shared" means the page reuses another role's implementation.

### User Pages

| Page | Code Name | Route | Implementation |
| --- | --- | --- | --- |
| 시작 화면 | `UserLandingPage` | `/app` | Implemented, shared with `LandingPage` |
| 로그인 / 회원가입 | `UserAuthPage` | `/app/auth` | Implemented |
| 메인 화면 | `UserHomePage` | `/app/home` | Implemented |
| 이벤트 목록 화면 | `EventListPage` | `/app/events` | Implemented, shared with home listing UI |
| 이벤트 상세 | `EventDetailPage` | `/app/events/:eventId` | Implemented |
| 티켓 예매 | `TicketPurchasePage` | `/app/tickets/:ticketId/purchase` | Implemented |
| 리셀 목록 | `ResaleListPage` | `/app/resale` | Implemented |
| 리셀 상세 | `ResaleDetailPage` | `/app/resale/:listingId` | Implemented |
| 구매 완료 | `PurchaseCompletePage` | `/app/purchase-complete` | Implemented |
| 마이페이지 | `UserMyPage` | `/app/me` | Implemented |
| 티켓 목록 | `MyTicketListPage` | `/app/tickets` | Implemented |
| 티켓 상세 | `TicketDetailPage` | `/app/tickets/:ticketId` | Implemented |
| 티켓 판매 등록 | `TicketResaleCreatePage` | `/app/tickets/:ticketId/resale` | Implemented |
| 판매 등록 완료 | `ResaleRegisterCompletePage` | `/app/resale-complete` | Implemented |
| QR / 바코드 표시 | `TicketQrPage` | `/app/tickets/:ticketId/qr` | Implemented |

### Organizer Pages

| Page | Code Name | Route | Implementation |
| --- | --- | --- | --- |
| 시작 화면 | `OrganizerLandingPage` | `/organizer/start` | Implemented, shared with `LandingPage` |
| 로그인 / 회원가입 | `OrganizerAuthPage` | `/organizer/auth` | Implemented, shared with `UserAuthPage` |
| 주최자 대시보드 | `OrganizerDashboardPage` | `/organizer` | Implemented |
| 이벤트 등록 | `EventCreatePage` | `/organizer/events/new` | Implemented |
| 티켓 발행 | `TicketIssuePage` | `/organizer/events/:eventId/tickets/issue` | Implemented |
| 내 이벤트 목록 | `OrganizerEventListPage` | `/organizer/events` | Implemented, shared with the organizer events list UI |
| 이벤트 관리 상세 | `OrganizerEventDetailPage` | `/organizer/events/:eventId` | Implemented |
| 이벤트 설정 | `EventSettingsPage` | `/organizer/events/:eventId/settings` | Implemented |
| 판매 현황 조회 | `SalesStatusPage` | `/organizer/events/:eventId/sales` | Implemented |
| 체크인 관리 | `CheckInManagePage` | `/organizer/events/:eventId/checkins` | Implemented |
| 내정보 | `OrganizerProfilePage` | `/organizer/me` | Implemented |

### Admin Pages

| Page | Code Name | Route | Implementation |
| --- | --- | --- | --- |
| 관리자 로그인 | `AdminLoginPage` | `/admin/login` | Implemented, shared with `LoginPage` |
| 관리자 대시보드 | `AdminDashboardPage` | `/admin` | Implemented |
| 주최자 승인 관리 | `OrganizerApprovalPage` | `/admin/organizer-approvals` | Implemented |
| 이벤트 감독 | `AdminEventManagePage` | `/admin/events` | Implemented |
| 사용자 관리 | `AdminUserManagePage` | `/admin/users` | Implemented |
| 거래 / 분쟁 관리 | `AdminDisputeTransactionPage` | `/admin/disputes` | Implemented |
| 블록체인 트랜잭션 모니터링 | `AdminBlockchainLogPage` | `/admin/blockchain` | Implemented |

## Implementation Notes

- Routing is centralized in `src/routes.tsx`.
- Role-aware path resolution lives in `src/lib/authRoute.ts`.
- API communication is handled by `src/lib/backend.ts`, which follows the backend response envelope (`success`, `status`, `code`, `message`, `data`).
- Blockchain calls are wrapped in `src/lib/blockchain/client.ts`.
- Shared page composition lives in `src/pages/portalPages.tsx`.
- The implementation currently covers the planned pages from the architecture docs. Some screens reuse the same underlying component for multiple roles, which is intentional and keeps the role-specific navigation consistent.

## Environment Variables

Copy `.env.example` to `.env` and set the values below:

```env
VITE_API_BASE_URL=/api/v1
VITE_BACKEND_ORIGIN=http://localhost:8080
VITE_CHAIN_RPC_URL=http://127.0.0.1:8545
VITE_CHAIN_ID=31337
VITE_TRUST_TICKET_CONTRACT_ADDRESS=0x...
```

`VITE_BACKEND_ORIGIN` is used by the Vite proxy so browser CORS issues are avoided in local development.

## How To Run

1. Start backend dependencies.
  - In `../backend`: `docker compose up -d postgres`
  - Optional local chain: `docker compose --profile chain up -d anvil`
2. Start the backend.
  - In `../backend`: `./gradlew bootRun`
3. Start the frontend.
  - In `./frontend`: `npm install`
  - In `./frontend`: `npm run dev`
4. Open the app.
  - Frontend: `http://localhost:5173`
  - Swagger: `http://localhost:8080/swagger-ui`

## Test Checklist

### Frontend

- Run unit tests: `npm run test`
- Run build verification: `npm run build`

### User Flow Smoke Test

- Open `/login` or `/register` and confirm auth navigation works.
- Sign in as a USER and verify redirects to user routes under `/app`.
- Open event detail, ticket purchase, resale detail, ticket detail, and QR pages.
- Confirm `GET /users/me`, `GET /tickets/me`, `GET /events`, and `GET /resale-listings` are called as expected.

### Organizer Flow Smoke Test

- Sign in as an ORGANIZER and verify redirects to `/organizer`.
- Open event creation, own event list, event detail, settings, sales, check-ins, ticket issue, and profile pages.
- Confirm event and ticket APIs are called from the corresponding screens.

### Admin Flow Smoke Test

- Sign in as an ADMIN and verify redirects to `/admin`.
- Open organizer approvals, event management, user management, disputes, and blockchain log pages.
- Confirm admin APIs return data and actions such as flag/unflag, approve/reject, suspend/activate/delete, and dispute review work.

### Blockchain Integration Smoke Test

- Ensure `VITE_TRUST_TICKET_CONTRACT_ADDRESS` points to a deployed TrustTicket contract.
- Use a wallet connected to the same chain as `VITE_CHAIN_ID`.
- Verify contract-backed flows from the UI using the browser devtools network and console.

