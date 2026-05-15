# Trust Ticket Frontend

Frontend app that is compatible with:

- Backend API in `../backend` (`http://localhost:8080/api/v1`)
- TrustTicket smart contract in `../blockchian-ticket/contracts/TrustTicket.sol`

## What Is Implemented

- User flow pages: landing, login/register, event list/search, event detail, resale list/detail, my page, ticket detail/resale registration.
- Organizer flow pages: dashboard, event creation, my events.
- Admin flow pages: dashboard, organizer approvals, disputes.
- Backend API client that follows backend response envelope (`success`, `status`, `code`, `message`, `data`).
- Contract wrapper based on Solidity function signatures in `blockchian-ticket/api.txt` and `TrustTicket.sol`.
- Vitest + Testing Library setup with a starter test.

## Project Structure

```
src/
  components/
  lib/
    blockchain/
  pages/
    admin/
    organizer/
    user/
  test/
```

## Environment Variables

Copy `.env.example` to `.env` and set values:

```
VITE_API_BASE_URL=/api/v1
VITE_BACKEND_ORIGIN=http://localhost:8080
VITE_CHAIN_RPC_URL=http://127.0.0.1:8545
VITE_CHAIN_ID=31337
VITE_TRUST_TICKET_CONTRACT_ADDRESS=0x...
```

`VITE_BACKEND_ORIGIN` is used by Vite proxy so browser CORS issues are avoided in local development.

## Local Run (Recommended)

1. Start backend dependencies:
   - In `../backend`: `docker compose up -d postgres`
   - Optional local chain: `docker compose --profile chain up -d anvil`
2. Start backend:
   - In `../backend`: `./gradlew bootRun`
3. Start frontend:
   - In `./frontend`: `npm install`
   - In `./frontend`: `npm run dev`
4. Open:
   - Frontend: `http://localhost:5173`
   - Swagger: `http://localhost:8080/swagger-ui`

## Testing Environment

### Frontend tests

- `npm run test`

### Frontend build check

- `npm run build`

### Backend integration sanity check

- Run backend and open Swagger UI.
- Login from frontend, then verify token-protected endpoints:
  - `/api/v1/users/me`
  - `/api/v1/tickets/me`
- Verify public endpoints:
  - `/api/v1/events`
  - `/api/v1/resale-listings`

### Blockchain integration sanity check

- Ensure `VITE_TRUST_TICKET_CONTRACT_ADDRESS` points to a deployed TrustTicket.
- Use a wallet (MetaMask) connected to the same chain as `VITE_CHAIN_ID`.
- Verify read calls from UI using browser devtools network + console.

## Git Scope Requirement

If you only want Git tracking inside `frontend`:

1. `cd frontend`
2. `git init`
3. `git add .`
4. `git commit -m "Initialize frontend app"`

This keeps version control scoped to this folder only.