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

- **Dashboard**: Shows key admin work items and operational metrics.
- **Organizer Approvals**: Reviews organizer applications.
- **Event Supervision**: Manages event review flags, admin cancellation, and reactivation.
- **User Management**: Manages user status and grants global validator permission.
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

The admin web currently grants global validator permission. Global validator removal is not implemented yet.

### Disputes

- Users create disputes in the mobile app.
- Admins review disputes in the admin web.
- Resale transaction monitoring is part of the admin dispute/transaction center.

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

- Decide whether to add global validator removal.
- Decide whether every blockchain submission failure should be persisted as `FAILED`.
- Add explorer links when a real blockchain network is configured.
- Replace demo-oriented QR signing with real mobile wallet signing.
- Decide whether reviewed events need a dedicated queue beyond the current filter.
