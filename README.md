# Trust Ticket Frontend

Trust Ticket has two separate frontend surfaces:

- `frontend/`: admin-only web console built with Vite, React, and TypeScript.
- `frontend/mobile/`: user, organizer, and validator mobile app built with Expo and React Native.

The web app no longer contains user or organizer web routes. Ticket purchase, resale, ticket QR, organizer event operation, and check-in flows belong to the mobile app.

## Project Overview

| Area | Path | Purpose |
| --- | --- | --- |
| Admin Web Console | `frontend/` | Platform operation, approval, supervision, disputes, users, and blockchain logs |
| Mobile App | `frontend/mobile/` | User ticket flows, organizer event operation, resale, QR, check-in, and disputes |
| Backend | `../backend/` | API server, PostgreSQL, blockchain gateway, and admin/mobile API support |

## Admin Web Console

### Active Routes

Routes are defined in `src/routes.tsx`.

| Route | Page |
| --- | --- |
| `/` | Admin landing page |
| `/login` | Admin login |
| `/admin` | Admin dashboard |
| `/admin/organizer-approvals` | Organizer approvals |
| `/admin/events` | Event supervision |
| `/admin/users` | User management |
| `/admin/disputes` | Dispute and resale transaction center |
| `/admin/blockchain` | Blockchain logs |

### Main Screens

- **Dashboard**: Shows review queues first: pending organizer approvals, pending event review, pending disputes, and operational metrics.
- **Organizer Approvals**: Reviews organizer applications.
- **Event Supervision**: Manages event review flags, admin cancellation, and reactivation.
- **User Management**: Manages user status and grants or revokes organizer and global validator roles. Status and role filters are separated, and role filters use AND matching.
- **Dispute/Transaction Center**: Reviews user disputes and monitors resale transactions.
- **Blockchain Logs**: Shows submitted or simulated blockchain actions recorded by the backend.

### Admin Web Structure

```text
frontend/
├── src/
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── RequireAdmin.tsx
│   │   └── AdminPagination.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── authRoute.ts
│   │   ├── backend.ts
│   │   ├── config.ts
│   │   └── http.ts
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── admin/
│   │       ├── AdminDashboardPage.tsx
│   │       ├── OrganizerApprovalsPage.tsx
│   │       ├── AdminEventsPage.tsx
│   │       ├── AdminUserManagePage.tsx
│   │       ├── AdminDisputeTransactionPage.tsx
│   │       └── AdminBlockchainLogPage.tsx
│   ├── routes.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

Admin API calls are centralized in `src/lib/backend.ts`.

## Mobile App

The mobile app lives under `frontend/mobile/` and uses the navigation stack in `mobile/App.tsx`.

### User Flows

- Authentication: `Landing`, `Auth`
- Primary ticket purchase: `Main`, `EventList`, `EventDetail`, `TicketPurchase`, `PurchaseComplete`
- Resale purchase: `ResaleList`, `ResaleDetail`, `PurchaseComplete`
- My tickets and QR: `MyPage`, `MyTickets`, `TicketDetail`, `TicketQr`
- Resale registration: `TicketResaleCreate`, `ResaleRegisterComplete`
- Disputes: `DisputeCreate`, `MyDisputes`

### Organizer and Validator Flows

- Organizer home: `Organizer`
- Event operation: `EventCreate`, `MyEvents`, `OrganizerEventDetail`
- Ticket issuance: `TicketIssue`
- Operational status: `SalesStatus`, `CheckInStatus`
- Settings and check-in: `EventSettings`, `CheckInManage`, `CheckInScan`
- Account: `OrganizerProfile`, `OrganizerLogout`

Mobile API calls are centralized in `frontend/mobile/src/lib/backend.ts`.

## Tech Stack

### Admin Web

- React 18
- TypeScript
- Vite
- React Router
- Axios
- Vitest and React Testing Library

### Mobile

- Expo
- React Native
- React Navigation
- Axios
- expo-secure-store
- expo-camera
- Reown AppKit / WalletConnect for mobile wallet connection
- react-native-qrcode-svg

## Running Locally

The backend requires PostgreSQL first. The Docker Compose file is in `backend/docker-compose.yml`.

```bash
cd ../backend
docker compose up -d postgres
./gradlew bootRun
```

Optional local EVM chain:

```bash
cd ../backend
docker compose --profile chain up -d anvil
```

Reset local development data:

```bash
cd ../backend
docker compose down -v
docker compose up -d postgres
```

Run the admin web console:

```bash
cd frontend
npm install
npm run dev
```

Run the mobile app on web:

```bash
cd frontend/mobile
npm install
npx expo start --web --port 8081
```

`npm run web -- --port 8081` is equivalent because the mobile package script runs `expo start --web`.

Run the mobile app with a development build for native MetaMask testing:

```bash
cd frontend/mobile
npm install
npx expo run:android
npm run start:dev-client
```

Expo Go can still be used with `npm run start:go`, but native MetaMask app connection should be tested in a development build because the app needs its own native runtime and scheme.

## Local Test URLs

Backend:

- API base: `http://localhost:8080/api/v1`
- Swagger UI: `http://localhost:8080/swagger-ui`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- Health: `http://localhost:8080/actuator/health`

Frontend:

- Admin web: `http://localhost:5173`
- Admin login: `http://localhost:5173/login`
- Admin dashboard: `http://localhost:5173/admin`
- Mobile web: `http://localhost:8081`

## Local Test Account And Flow

The backend creates only one local development admin account on startup. There is no seeded user, event, ticket, or resale data beyond this account.

```text
Admin email: dev-admin@local.test
Admin password: Admin1234!
Roles: USER, ORGANIZER, ADMIN, VALIDATOR
```

Use this account in the admin web console for organizer approvals, user management, event supervision, disputes, and blockchain logs.

For user/mobile testing:

1. Start the backend, admin web, and mobile web.
2. Open `http://localhost:8081`.
3. Create a new user from the mobile app with email/password or wallet login.
4. After signup/login, the user-side screens are available from the mobile app.
5. Purchase, resale, QR, and ticket-detail flows need event and ticket data, so create/issue those through an approved organizer account first.

For organizer testing:

1. Create or log in as a normal user in the mobile app.
2. Enter the organizer flow and submit an organizer application.
3. Log in to the admin web with `dev-admin@local.test / Admin1234!`.
4. Approve the organizer application under `/admin/organizer-approvals`.
5. Log out and log back in on the mobile app so the JWT includes the new `ORGANIZER` role.
6. The organizer can then create events, issue tickets, manage sales, check-in, and event settings from the mobile app.

## Environment Variables

Admin web uses `frontend/.env`.

```text
VITE_API_BASE_URL=/api/v1
VITE_BACKEND_ORIGIN=http://localhost:8080
VITE_CHAIN_RPC_URL=http://127.0.0.1:8545
VITE_CHAIN_ID=31337
VITE_TRUST_TICKET_CONTRACT_ADDRESS=
```

Mobile uses `frontend/mobile/.env`.

```text
EXPO_PUBLIC_WEB_API_BASE_URL=http://localhost:8080/api/v1
# Optional for Expo Go on a physical phone if automatic PC IP detection fails.
# Replace the IP with your PC Wi-Fi/LAN IPv4 address.
# EXPO_PUBLIC_MOBILE_API_BASE_URL=http://192.168.0.10:8080/api/v1
EXPO_PUBLIC_API_PORT=8080
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
# Metadata shown in MetaMask connection requests.
EXPO_PUBLIC_DAPP_NAME=Trust Ticket
EXPO_PUBLIC_DAPP_URL=https://trust-ticket.local
# Use a phone-reachable RPC URL for MetaMask Mobile, for example your PC Wi-Fi/LAN IPv4.
EXPO_PUBLIC_CHAIN_RPC_URL=http://localhost:8545
EXPO_PUBLIC_CHAIN_ID=31337
EXPO_PUBLIC_TRUST_TICKET_CONTRACT_ADDRESS=
```

## Current Policies

### Event Review and Cancellation

| Item | Behavior |
| --- | --- |
| Review | Admin-only marker for events that need another look. It does not affect sales or check-in. |
| Organizer cancellation | The organizer can reactivate the event. |
| Admin cancellation | The organizer cannot reactivate the event. Only an admin can reactivate it. |

Admin cancellation is distinguished by the backend `adminCanceled` field.

### Validators

| Type | Behavior |
| --- | --- |
| Global validator | Can process QR check-ins for all events. |
| Event validator | Can process QR check-ins only for a specific event. |

The admin web can grant and revoke global validator permission. Organizer role grant/revoke is also available from user management.

### Disputes

- Users create disputes in the mobile app.
- Dispute target selection is based on user-readable ticket or resale transaction cards.
- Target cards prioritize event name, venue, event date/time, and seat. Resale disputes also show transaction price and transaction time when available.
- Duplicate active disputes are blocked by user + ticket/listing target, and the user-facing message states that the same ticket or transaction was already reported.
- Users can edit or cancel disputes while they are still in an early status such as `OPEN` or `RECEIVED`.
- Admins review disputes in the admin web.
- Resale transaction monitoring is part of the admin dispute/transaction center.

### Organizer Ticket Issuance

- Default seat sections are `A`, `B`, `C`, `D`, and `VIP`.
- Organizers can add custom seat sections, and newly added sections become selectable immediately.
- Issued ticket seat prefixes are not automatically merged into the editable seat-section list, so accidental prefixes such as partial `R` or `X` values do not appear as default filters.
- Seat sections that already have issued tickets cannot be deleted.

### Blockchain Logs

| Status | Meaning |
| --- | --- |
| `SIMULATED` | Recorded without sending an actual chain transaction. |
| `SUBMITTED` | Chain transaction was submitted and a transaction hash was received. |
| `FAILED` | Submission or logging failed. |

The current admin UI does not track confirmations, receipts, or finality.

## Verification

Admin web:

```bash
npm run build
npm test
```

Mobile:

```bash
cd mobile
npx tsc --noEmit
```

## Remaining Work

### 핵심 백엔드 / 운영 구조 개선

- 현재 데모용 QR signature(`mobile-dev-signature`) 구조를 실제 운영 가능한 방식으로 교체 필요
  - wallet `signMessage` 기반 사용자 서명 검증
  - 또는 서버 발급 체크인 토큰 구조 적용
  - 체크인 API에서도 QR payload signature 검증 로직 추가 필요

- 내 리셀 거래 전용 API 추가 필요
  - 현재는 전체 리셀 목록 조회 후 프론트에서 sellerId / buyerId 기준으로 필터링 중
  - 데이터 증가 시 비효율 및 권한 관리 문제가 발생할 수 있음
  - 예시:
    - `GET /resale-listings/me`
    - `GET /resale-transactions/me`

- 이미 발행된 티켓 취소 API 추가 필요
  - 예시:
    - `PATCH /tickets/{ticketId}/cancel`
    - `PATCH /events/{eventId}/tickets/cancel-bulk`

- `GET /disputes/me` 응답에 분쟁 대상 summary 정보 직접 포함 필요
  - 현재 모바일 앱은 ticket / resale / event 정보를 개별 추가 조회로 보강 중
  - API에서 아래 정보를 직접 제공하면 호출 수를 줄일 수 있음:
    - 이벤트명
    - 장소
    - 이벤트 날짜
    - 좌석 정보
    - 리셀 가격 / 거래 일시

- organizer / validator 권한 revoke의 온체인 연동 필요
  - 현재는 DB role만 제거됨
  - 스마트컨트랙트 revoke 함수 및 gateway 연동 추가 필요

---

### 관리자 / 운영 기능 개선

- 관리자 대시보드의 “판매중 티켓 수” 집계 API 추가 필요
  - 현재는 placeholder 또는 optional 값 기반 처리 중

- 이벤트 운영 상태와 검토 상태 분리 검토 필요
  - 현재는 `ACTIVE / INACTIVE` 중심 구조
  - 추후 운영 규모 확장 시 아래와 같은 검토 상태 분리 가능:
    - `PENDING_REVIEW`
    - `APPROVED`
    - `REJECTED`

---

### 문서 / 배포 정리

- README 및 배포 문서 보강 필요
  - 모바일 앱 테스트 방법
  - Android 설치 및 실행 가이드
  - `.env` 설정 예시
  - 로컬 / 배포 환경 접속 구조
  - 모바일 지갑 연동 구조
  - 주최자 승인 및 권한 승격 흐름
  - 전체 배포 아키텍처 정리
