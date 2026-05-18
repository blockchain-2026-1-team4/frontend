# Trust Ticket 프론트엔드

현재 프론트엔드는 역할별로 분리되어 있습니다.

- `frontend/`: 관리자 전용 웹 콘솔
- `frontend/mobile/`: 사용자/주최자용 React Native + Expo 앱

웹 앱은 더 이상 사용자/주최자 웹 라우트를 담당하지 않습니다. 티켓 예매, 리셀, QR, 주최자 이벤트 운영은 모바일 앱에서 처리합니다.

## 관리자 웹 콘솔

사용 기술:

- Vite
- React
- React Router
- Axios
- TypeScript

활성 웹 라우트:

```text
/                          관리자 랜딩
/login                     관리자 로그인
/admin                     관리자 대시보드
/admin/organizer-approvals 주최자 승인
/admin/events              이벤트 감독
/admin/users               사용자 관리
/admin/disputes            분쟁/리셀 거래 센터
/admin/blockchain          블록체인 트랜잭션 로그
```

관리자 웹에서 제거된 범위:

- `/app/*` 사용자 웹 라우트
- `/organizer/*` 주최자 웹 라우트
- `src/pages/user`
- `src/pages/organizer`
- 웹 회원가입 화면
- 웹 모바일형 사용자/주최자 레이아웃

## 모바일 앱

모바일 앱은 `frontend/mobile` 아래에 있으며 관리자 웹 정리와 별도로 유지됩니다.

사용자 흐름:

```text
Landing -> Auth -> Main -> EventList -> EventDetail -> TicketPurchase -> PurchaseComplete
Landing -> Auth -> Main -> ResaleList -> ResaleDetail -> PurchaseComplete
MyPage -> MyTickets -> TicketDetail -> TicketQr
MyPage -> MyTickets -> TicketDetail -> TicketResaleCreate -> ResaleRegisterComplete
TicketDetail / ResaleDetail -> DisputeCreate -> MyDisputes
MyPage -> MyDisputes
```

주최자/검증자 흐름:

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

## 주요 파일 구조

```text
frontend/src/
  App.tsx
  routes.tsx
  styles.css
  components/
    Layout.tsx
    RequireAdmin.tsx
    AdminPagination.tsx
  lib/
    auth.ts
    authRoute.ts
    backend.ts
    config.ts
    http.ts
  pages/
    LandingPage.tsx
    LoginPage.tsx
    admin/
      AdminDashboardPage.tsx
      OrganizerApprovalsPage.tsx
      AdminEventsPage.tsx
      AdminUserManagePage.tsx
      AdminDisputeTransactionPage.tsx
      AdminBlockchainLogPage.tsx
```

## 인증과 API 클라이언트

웹:

- `src/lib/config.ts`: `VITE_API_BASE_URL` 등 환경값을 읽습니다.
- `src/lib/auth.ts`: 액세스 토큰을 `localStorage`에 저장합니다.
- `src/lib/http.ts`: Axios 인스턴스를 만들고 `Authorization: Bearer <token>`을 주입하며, `401` 응답에서는 토큰을 제거합니다.
- `src/lib/authRoute.ts`: 로그인 사용자가 `ADMIN` 역할을 갖는지 확인합니다.
- `src/lib/backend.ts`: 관리자 화면에서 쓰는 API 래퍼입니다.

모바일:

- `mobile/src/lib/auth.ts`: 네이티브에서는 `expo-secure-store`, Expo Web에서는 `localStorage`에 토큰을 저장합니다.
- `mobile/src/lib/http.ts`: 비동기 bearer-token 주입과 백엔드 `ApiEnvelope<T>` 언래핑을 담당합니다.
- `mobile/src/lib/backend.ts`: 사용자/주최자/체크인/분쟁 API 래퍼입니다.

## 관리자 API 연결

| 백엔드 API | 웹 화면 |
| --- | --- |
| `POST /auth/email/login` | 로그인 |
| `GET /users/me` | 관리자 권한 확인 |
| `GET /admin/dashboard` | 관리자 대시보드 |
| `GET /organizer-applications` | 주최자 승인 |
| `PATCH /organizer-applications/{applicationId}/review` | 주최자 승인/거절 |
| `GET /admin/events` | 이벤트 감독 |
| `PATCH /admin/events/{eventId}/flag` | 이벤트 검토 표시 |
| `PATCH /admin/events/{eventId}/unflag` | 이벤트 검토 표시 해제 |
| `PATCH /events/{eventId}/status` | 이벤트 관리자 취소/복구 |
| `GET /users` | 사용자 관리 |
| `PATCH /users/{userId}/suspend` | 사용자 정지 |
| `PATCH /users/{userId}/activate` | 사용자 활성화 |
| `PATCH /users/{userId}/delete` | 사용자 삭제 처리 |
| `PATCH /users/{userId}/validator` | 전역 체크인 검증자 권한 부여 |
| `GET /admin/disputes` | 분쟁 목록 |
| `PATCH /admin/disputes/{disputeId}/review` | 분쟁 처리 |
| `GET /admin/resale-transactions` | 리셀 거래 모니터링 |
| `GET /admin/blockchain-transactions` | 블록체인 로그 |

## 관리자 기능 정책

### 이벤트 감독

- `검토 표시`는 `EventEntity.flagged`만 바꾸는 운영 메모성 표시입니다.
- 검토 표시를 해도 이벤트 상태, 티켓 구매, 리셀, 체크인은 막히지 않습니다.
- `취소`는 이벤트 상태를 `CANCELED`로 변경하며 티켓 구매/리셀/체크인을 막는 위험 작업입니다.
- 정책은 `관리자 취소 -> 주최자 복구 불가, 관리자 복구 가능`입니다.
- 이를 위해 백엔드는 `events.admin_canceled` 필드를 사용합니다.
- 관리자가 취소하면 `adminCanceled=true`가 되고, 주최자가 모바일 앱에서 `ACTIVE` 또는 `INACTIVE`로 되돌리려 하면 백엔드가 거부합니다.
- 관리자는 관리자 웹의 `복구` 버튼으로 `ACTIVE` 상태로 되돌릴 수 있고, 이때 `adminCanceled=false`가 됩니다.
- 이벤트 감독 화면은 상태 필터와 별도로 `전체 / 검토 표시됨 / 정상` 필터를 제공합니다. 이 필터는 `GET /admin/events?flagged=true|false`에 연결됩니다.

### 사용자 관리과 체크인 검증자

- `PATCH /users/{userId}/validator`는 전역 `VALIDATOR` 역할을 부여합니다.
- 전역 체크인 검증자는 모든 이벤트에서 체크인 검증을 수행할 수 있습니다.
- 이벤트별 검증자는 주최자 또는 관리자가 `POST /events/{eventId}/validators`로 특정 이벤트에 등록한 사용자입니다.
- 체크인 권한은 `ADMIN`, 전역 `VALIDATOR`, 이벤트별 검증자 중 하나면 통과합니다.
- 지갑 주소가 있는 사용자에게 전역 검증자 권한을 부여하면 `addValidator` 블록체인 로그가 기록됩니다.

### 체크인 시연

- 사용자 앱은 `TicketQrPage`에서 QR payload를 생성해 보여줍니다.
- 검증자/주최자 앱은 `CheckInManagePage`에서 QR을 스캔하거나 payload를 직접 붙여넣어 입장 처리할 수 있습니다.
- QR 스캔은 `CheckInScanPage`의 카메라 스캔 결과를 `CheckInManagePage`로 전달합니다.
- 수동 입력은 QR payload JSON 또는 `ticketId`, `claimedOwner`, `expiresAt`, `signature` 필드를 직접 입력하는 방식입니다.
- 입장 처리는 `POST /check-ins`로 연결됩니다.
- 성공, 이미 체크인됨, 권한 없음, QR 서명/상태 오류 메시지를 화면과 알림으로 표시합니다.

### 분쟁/리셀 거래

- 사용자 앱은 `POST /disputes`로 분쟁을 생성하고 `GET /disputes/me`로 내 분쟁 내역을 조회합니다.
- 분쟁 생성에는 `ticketId` 또는 `resaleListingId` 중 하나와 `type`, `description`이 필요합니다.
- `TicketDetail`과 `ResaleDetail`에서 분쟁 신고 화면으로 진입할 수 있습니다.
- 관리자 웹은 `GET /admin/disputes`와 `PATCH /admin/disputes/{disputeId}/review`로 접수된 분쟁을 검토합니다.
- 리셀 거래 모니터링은 `GET /admin/resale-transactions`를 사용합니다.

### 블록체인 로그

- 관리자 웹은 `GET /admin/blockchain-transactions`로 백엔드가 기록한 트랜잭션 로그를 조회합니다.
- `SIMULATED`는 `app.blockchain.enabled=false`인 상태에서 실제 체인 전송 대신 `NoopTrustTicketGateway`가 기록한 상태입니다.
- `SUBMITTED`는 `Web3jTrustTicketGateway`가 컨트랙트 트랜잭션을 제출하고 해시를 받은 상태입니다.
- 현재 백엔드는 컨펌 수, receipt, finality까지 추적하지 않습니다.
- 기록 액션에는 `addOrganizer`, `addValidator`, `addEventValidator`, `createEvent`, `setEventStatus`, `mintTicket`, `purchaseTicket`, `listTicket`, `purchaseResaleTicket`, `cancelListing`, `useTicket` 등이 있습니다.

## 남은 TODO

- 블록체인 제출 실패도 `FAILED` 로그로 남길지 결정해야 합니다. 현재 Web3j 오류는 기록 전에 예외로 끝날 수 있습니다.
- 관리자 이벤트 감독에서 검토 표시 목록을 별도 큐처럼 보여줄지, 현재 필터 UI로 충분한지 결정해야 합니다.
- 실제 네트워크 설정이 생기면 관리자 블록체인 로그에 explorer 링크를 추가합니다.
- 모바일 QR 서명은 현재 시연 중심 구현입니다. 실제 모바일 지갑 서명 연동이 필요합니다.
- `src/lib/blockchain/client.ts`가 향후 관리자 직접 컨트랙트 도구로 필요한지, 백엔드 중개 방식만 사용할지 결정 후 정리합니다.

## 실행

관리자 웹:

```bash
cd frontend
npm install
npm run dev
```

모바일 앱:

```bash
cd frontend/mobile
npm install
npx expo start --web
```

백엔드:

```bash
cd backend
./gradlew bootRun
```

## 검증

웹 타입 체크:

```bash
cd frontend
npx tsc -p tsconfig.app.json --noEmit --incremental false
```

웹 테스트:

```bash
cd frontend
npm test
```

모바일 타입 체크:

```bash
cd frontend/mobile
npx tsc --noEmit
```
