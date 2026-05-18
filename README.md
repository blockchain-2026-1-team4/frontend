# Trust Ticket Frontend

Trust Ticket frontend is split into two client applications.

- `frontend/`: Vite + React web app for the admin portal, a simple user web flow, and a simple organizer web flow.
- `frontend/mobile/`: React Native + Expo app for the mobile user and organizer flows.

The backend API base path is `/api/v1`. Both clients use Axios wrappers that unwrap the backend `ApiEnvelope<T>` response shape and attach a bearer token when one is stored.

## Project Structure

```text
frontend/
  src/
    App.tsx
    routes.tsx
    components/
      Layout.tsx
      RequireAdmin.tsx
      UserAppLayout.tsx
      OrganizerAppLayout.tsx
    lib/
      auth.ts
      authRoute.ts
      backend.ts
      config.ts
      http.ts
      blockchain/
        abi.ts
        client.ts
    pages/
      admin/
      organizer/
      user/
      LandingPage.tsx
      LoginPage.tsx
      RegisterPage.tsx
    types/
      api.ts
  mobile/
    App.tsx
    src/
      lib/
        account.ts
        auth.ts
        backend.ts
        config.ts
        http.ts
      pages/
      types/
        api.ts
```

## Web App

The web app uses `react-router-dom` routes from `src/routes.tsx`.

User routes:

```text
/app
/app/events
/app/events/:eventId
/app/resale
/app/resale/:listingId
/app/me
/app/tickets
/app/tickets/:ticketId
```

Organizer routes:

```text
/organizer
/organizer/events
/organizer/events/new
/organizer/me
/organizer/start
```

Admin routes:

```text
/admin
/admin/organizer-approvals
/admin/events
/admin/users
/admin/disputes
/admin/blockchain
```

Admin routes are guarded by `RequireAdmin`, which calls `GET /users/me` and checks the `ADMIN` role.

The web user and organizer pages are lightweight portal pages. The admin portal is more complete and covers dashboard, organizer approval, event supervision, user management, dispute/resale transaction review, and blockchain transaction log viewing.

## Mobile App

The mobile app uses React Navigation in `mobile/App.tsx`.

User flow:

```text
Landing -> Auth -> Main -> EventList -> EventDetail -> TicketPurchase -> PurchaseComplete
Landing -> Auth -> Main -> ResaleList -> ResaleDetail -> PurchaseComplete
MyPage -> MyTickets -> TicketDetail -> TicketQr
MyPage -> MyTickets -> TicketDetail -> TicketResaleCreate -> ResaleRegisterComplete
```

Organizer flow:

```text
Landing -> Auth -> Organizer
Organizer -> EventCreate -> TicketIssue
Organizer -> MyEvents -> OrganizerEventDetail
OrganizerEventDetail -> SalesStatus
OrganizerEventDetail -> CheckInStatus
OrganizerEventDetail -> EventSettings
OrganizerEventDetail -> CheckInManage -> CheckInScan
Organizer -> OrganizerProfile
Organizer -> OrganizerLogout
```

The mobile app currently has no admin route. Admin APIs are present in `mobile/src/lib/backend.ts` as shared client methods, but they are not wired to mobile admin screens.

## Common API, Client, And Auth

Web:

- `src/lib/config.ts`: reads `VITE_API_BASE_URL`, chain RPC, chain ID, and contract address.
- `src/lib/auth.ts`: stores the access token in `localStorage`.
- `src/lib/http.ts`: creates the Axios instance, injects `Authorization: Bearer <token>`, clears token on `401`, and unwraps `ApiEnvelope<T>`.
- `src/lib/backend.ts`: typed backend API wrapper for auth, users, events, tickets, resale, organizer applications, admin, disputes, check-in, and blockchain transaction log APIs.

Mobile:

- `mobile/src/lib/config.ts`: reads `EXPO_PUBLIC_API_BASE_URL`, chain RPC, chain ID, and contract address.
- `mobile/src/lib/auth.ts`: stores token in `expo-secure-store` on native and `localStorage` on Expo Web.
- `mobile/src/lib/http.ts`: same bearer-token and envelope behavior as web, with async token access.
- `mobile/src/lib/backend.ts`: mobile API wrapper. It includes email auth, wallet auth, user/event/ticket/resale/organizer/check-in/admin wrappers.
- `mobile/src/lib/account.ts`: role/status-based entry routing and account status messages.

## Backend API Usage Audit

Status meanings:

- Used: actively called from at least one frontend screen.
- Partial: called, but the UI or request shape is temporary or not complete.
- Exposed only: present in a frontend API client but not currently called by a screen.
- Not connected: not present or not used in frontend.

### Auth

| Backend API | Web | Mobile | Notes |
| --- | --- | --- | --- |
| `POST /auth/email/register` | `RegisterPage` | `AuthPage` | Used correctly for email signup. |
| `POST /auth/email/login` | `LoginPage` | `AuthPage`, legacy `LoginPage` | Used correctly and stores access token. |
| `POST /auth/wallet/nonce` | Not connected | `AuthPage` | Mobile asks the user to enter wallet address manually. |
| `POST /auth/wallet/login` | Not connected | `AuthPage` | Mobile sends manually entered signature. There is no native wallet connection yet. |

### Users

| Backend API | Web | Mobile | Notes |
| --- | --- | --- | --- |
| `GET /users/me` | auth guards, admin pages | `LandingPage`, `AuthPage`, `MyPage`, organizer pages | Used broadly for session, role, and profile checks. |
| `PATCH /users/me` | Exposed only | `OrganizerProfilePage` | Mobile uses it for display-name update. User profile edit screen is not separate. |
| `GET /users` | `AdminUserManagePage` | Exposed only | Admin web usage is appropriate. |
| `PATCH /users/{userId}/suspend` | `AdminUserManagePage` | Exposed only | Admin web usage is appropriate. |
| `PATCH /users/{userId}/activate` | `AdminUserManagePage` | Exposed only | Admin web usage is appropriate. |
| `PATCH /users/{userId}/delete` | `AdminUserManagePage` | Exposed only | Admin web usage is appropriate. |
| `PATCH /users/{userId}/validator` | `AdminUserManagePage` | Exposed only | Admin web usage is appropriate. |

### Organizer Applications

| Backend API | Web | Mobile | Notes |
| --- | --- | --- | --- |
| `POST /organizer-applications` | Exposed only | `OrganizerDashboardPage` | Mobile organizer application flow is connected. |
| `GET /organizer-applications/me` | Exposed only | `OrganizerDashboardPage` | Used for showing application state. |
| `GET /organizer-applications` | `OrganizerApprovalsPage` | Exposed only | Admin web approval flow is connected. |
| `PATCH /organizer-applications/{applicationId}/review` | `OrganizerApprovalsPage` | Exposed only | Admin web approval/rejection is connected. |

### Events And Tickets

| Backend API | Web | Mobile | Notes |
| --- | --- | --- | --- |
| `GET /events` | `UserHomePage` | `UserHomePage`, `EventListPage` | Query/category usage is appropriate. |
| `GET /events/{eventId}` | user pages | user and organizer pages | Used for event detail and display enrichment. |
| `GET /events/me` | `MyEventsPage` | `OrganizerDashboardPage`, `MyEventsPage` | Organizer event list is connected. |
| `POST /events` | `EventCreatePage` | `EventCreatePage` | Organizer event creation is connected. |
| `PATCH /events/{eventId}` | Exposed only | `EventSettingsPage` | Mobile organizer event edit is connected. |
| `PATCH /events/{eventId}/status` | `AdminEventsPage` | organizer pages | Used for admin cancellation/flag-related flows and mobile organizer status changes. |
| `PATCH /events/{eventId}/resale-policy` | Exposed only | `EventSettingsPage` | Mobile organizer policy edit is connected. |
| `POST /events/{eventId}/image` | Exposed only | Exposed only | No current upload UI; mobile settings use image URL style handling instead. |
| `POST /events/{eventId}/validators` | Exposed only | `CheckInManagePage` | Mobile organizer check-in validator registration is connected. |
| `GET /events/{eventId}/validators` | Exposed only | `CheckInManagePage` | Mobile organizer validator list is connected. |
| `POST /events/{eventId}/tickets` | Exposed only | `TicketIssuePage` | Mobile organizer ticket issue flow is connected. |
| `GET /events/{eventId}/tickets` | Exposed only | event, organizer, sales, check-in pages | Used for primary ticket discovery and organizer dashboards. |
| `GET /tickets/me` | `MyPage` | `MyTicketsPage` | User ticket list is connected. |
| `GET /tickets/{ticketId}` | `TicketDetailPage` | purchase/detail/resale/QR pages | Used appropriately; mobile often fetches event separately for display. |
| `GET /tickets/{ticketId}/validity` | Exposed only | `TicketDetailPage`, `TicketResaleCreatePage` | Used before detail/resale UI. |
| `GET /wallets/{walletAddress}/tickets` | Not connected | Not connected | No frontend wrapper or screen uses wallet-based ticket lookup yet. |
| `POST /tickets/{ticketId}/purchase` | `EventDetailPage` prompt flow | `TicketPurchasePage` | Mobile is structured; web still uses a prompt for ticket ID. |

### Resale And Check-In

| Backend API | Web | Mobile | Notes |
| --- | --- | --- | --- |
| `GET /resale-listings` | `ResaleListPage` | `ResaleListPage`, `EventDetailPage` | Connected. Event detail needs event filtering but backend only supports page/size. |
| `GET /resale-listings/{listingId}` | Not connected in current web detail | `ResaleDetailPage` | Mobile uses it. Web resale detail currently purchases by route ID without loading detail. |
| `POST /tickets/{ticketId}/resale-listing` | `TicketDetailPage` | `TicketResaleCreatePage` | Connected. Mobile reuses completion page. |
| `POST /resale-listings/{listingId}/purchase` | `ResaleDetailPage` | `ResaleDetailPage` | Connected. |
| `PATCH /resale-listings/{listingId}/cancel` | Exposed only | Exposed only | No UI currently cancels a resale listing. |
| `POST /tickets/{ticketId}/qr` | Exposed only | `TicketQrPage` | Mobile uses a placeholder signature. Needs wallet signing. |
| `GET /tickets/{ticketId}/check-in-message` | Exposed only | Exposed only | Not used by mobile QR generation yet. Should feed wallet signing. |
| `POST /check-ins` | Exposed only | `CheckInManagePage` | Mobile organizer check-in processing is connected. |
| `GET /tickets/{ticketId}/check-ins` | Exposed only | `CheckInStatusPage` | Mobile organizer check-in history is connected. |
| `POST /disputes` | Not connected | Not connected | No frontend dispute creation flow yet. |
| `GET /disputes/me` | Not connected | Not connected | No user dispute history flow yet. |

### Admin

| Backend API | Web | Mobile | Notes |
| --- | --- | --- | --- |
| `GET /admin/dashboard` | `AdminDashboardPage` | Exposed only | Admin web connected. |
| `GET /admin/blockchain-transactions` | `AdminBlockchainLogPage` | Exposed only | Admin web transaction log connected. |
| `GET /admin/events` | `AdminEventsPage` | Exposed only | Admin web event supervision connected. |
| `PATCH /admin/events/{eventId}/flag` | `AdminEventsPage` | Exposed only | Admin web connected. |
| `PATCH /admin/events/{eventId}/unflag` | `AdminEventsPage` | Exposed only | Admin web connected. |
| `GET /admin/resale-transactions` | `AdminDisputeTransactionPage` | Exposed only | Admin web connected. |
| `GET /admin/disputes` | `AdminDisputeTransactionPage`, `DisputesPage` | Exposed only | Admin web connected. |
| `PATCH /admin/disputes/{disputeId}/review` | `AdminDisputeTransactionPage` | Exposed only | Admin web connected. |

## User Plan API Fit

The planned user flow is mostly connected in the mobile app.

Connected:

- Login/signup: email and manual wallet auth APIs are wired in `mobile/src/pages/AuthPage.tsx`.
- Main/event list/search/category: `GET /events` is used with `query` and `category`.
- Event detail: `GET /events/{eventId}` and `GET /events/{eventId}/tickets` are used.
- Primary purchase: `POST /tickets/{ticketId}/purchase` is used by `TicketPurchasePage`.
- Purchase complete: reuses returned ticket/listing IDs and routes to ticket detail or ticket list.
- Resale list/detail/purchase: `GET /resale-listings`, `GET /resale-listings/{listingId}`, and `POST /resale-listings/{listingId}/purchase` are used.
- My page/ticket list/ticket detail: `GET /users/me`, `GET /tickets/me`, `GET /tickets/{ticketId}`, and `GET /tickets/{ticketId}/validity` are used.
- Ticket resale registration: `POST /tickets/{ticketId}/resale-listing` is used, then `ResaleRegisterCompletePage` is reused.

Temporary or incomplete:

- Event-specific resale list: mobile filters `GET /resale-listings` client-side by `eventId`. Backend does not currently accept `eventId` for that endpoint.
- QR generation: `TicketQrPage` calls `POST /tickets/{ticketId}/qr` with `signature: "mobile-dev-signature"`. This is a placeholder and not a real wallet signature.
- Wallet login: mobile uses backend wallet nonce/login endpoints, but the user manually enters wallet address and signature. There is no mobile wallet connector/deep-link flow.
- Web user primary purchase still prompts for a ticket ID instead of showing a ticket selection UI.
- Web resale detail does not currently load `GET /resale-listings/{listingId}` before purchase.

Not connected from the user plan:

- `GET /tickets/{ticketId}/check-in-message` is not used by `TicketQrPage`; it should be part of the real wallet-signing QR flow.
- `GET /wallets/{walletAddress}/tickets` has no frontend usage.
- User dispute creation/history APIs are not wired.

## Blockchain And Wallet Integration

Backend-mediated blockchain:

- Most product flows call backend REST APIs. The backend decides whether to submit real chain transactions or simulated transactions.
- Frontend purchase/resale/check-in screens do not directly call smart contract write methods in the current UI.
- Admin blockchain transaction logs are connected through `GET /admin/blockchain-transactions` in `AdminBlockchainLogPage`.

Direct web blockchain utilities:

- `src/lib/blockchain/client.ts` defines ethers-based helpers for read calls, wallet connection, check-in hash signing, and `purchaseTicket`.
- Current search shows these helpers are not imported by any page. They are available but not wired into active UI flows.
- The web app can be configured with `VITE_CHAIN_RPC_URL`, `VITE_CHAIN_ID`, and `VITE_TRUST_TICKET_CONTRACT_ADDRESS`.

Mobile blockchain utilities:

- `mobile/src/lib/config.ts` has chain RPC and contract configuration values.
- There is no mobile blockchain client implementation under `mobile/src` currently.
- Mobile includes `ethers` as a dependency, but no active mobile screen calls smart contracts directly.

Wallet auth and signatures:

- Mobile wallet login uses `POST /auth/wallet/nonce` and `POST /auth/wallet/login`, but address/signature input is manual.
- Web wallet login is not connected.
- QR generation needs a real signature over the check-in payload. Mobile currently has a TODO and sends a development placeholder signature.
- `CheckInManagePage` can parse a QR payload and send `POST /check-ins`; this is the validator-side processing path, not the owner-side signing path.

## Remaining TODO

- Add backend support for event-scoped resale listing queries, such as `GET /resale-listings?eventId={eventId}`, then remove mobile client-side filtering.
- Replace mobile QR placeholder signature with a real wallet signature flow.
- Add mobile wallet connection/deep-link support for nonce login and QR signing.
- Decide how email-only users should generate QR codes if they do not have a wallet address/signature.
- Wire `GET /tickets/{ticketId}/check-in-message` into QR signing flow.
- Decide whether direct frontend blockchain utilities should be used in UI or removed in favor of backend-mediated blockchain only.
- Keep admin blockchain transaction log as the canonical frontend view for backend-recorded on-chain/simulated actions, and consider adding transaction detail links if real explorers are configured.
- Add user dispute creation and user dispute history pages if dispute APIs are part of the user scope.
- Add resale cancel UI for sellers.
- Consider enriching ticket/resale response DTOs or adding frontend batching to reduce repeated event/ticket detail fetches.
- Add image upload UI if `POST /events/{eventId}/image` should be used from frontend instead of URL-only handling.
- Add smoke tests for mobile user purchase, resale purchase, resale registration, and QR generation once fixtures are available.

## Run

Web:

```bash
cd frontend
npm install
npm run dev
```

Mobile web:

```bash
cd frontend/mobile
npm install
npx expo start --web
```

Mobile native:

```bash
cd frontend/mobile
npm install
npm run android
# or
npm run ios
```

Backend:

```bash
cd backend
./gradlew bootRun
```

## Verification

Web type check:

```bash
cd frontend
npx tsc -p tsconfig.app.json --noEmit --incremental false
```

Web tests:

```bash
cd frontend
npm test
```

Mobile type check:

```bash
cd frontend/mobile
npx tsc --noEmit
```
