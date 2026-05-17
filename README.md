# Trust Ticket Frontend

Trust Ticket frontend는 모바일 앱과 관리자 웹 포털을 함께 관리하는 클라이언트 프로젝트입니다.

- `frontend/`: Vite + React 기반 관리자 웹 포털
- `frontend/mobile/`: React Native + Expo 기반 사용자/주최자 모바일 앱

## 관리자 웹 포털

#### 주요 경로 :

```text
/                           메인 페이지
/login                      로그인
/register                   회원가입
/admin                      관리자 대시보드
/admin/organizer-approvals  주최자 승인
/admin/events               이벤트 감독
/admin/users                사용자 관리
/admin/disputes             분쟁/거래 센터
/admin/blockchain           블록체인 로그
```

#### 구현된 화면 :

- 관리자 대시보드: 이벤트, 티켓, 입장, 리셀 운영 지표 API 연동
- 주최자 승인: 신청 목록 조회, 승인/거절, 로그인 만료 안내
- 이벤트 감독: 이벤트 목록 조회, 상태 필터, 검색, 플래그/해제, 페이지네이션
- 사용자 관리: 회원 목록 조회, 상태 필터, 검색, 정지/활성화/삭제/검증자 부여, 페이지네이션
- 분쟁/거래 센터: 분쟁 목록과 리셀 거래 목록을 분리 표시, 분쟁 상태 처리, 각각 페이지네이션
- 블록체인 로그: 최근 트랜잭션 상태, 실패 로그, 검색/상태 필터

#### 공통 처리 :

- 관리자 전용 라우트 가드
- 관리자 권한이 없거나 세션이 만료된 경우 재로그인 안내
- 로그인 성공 후 `ADMIN` 권한이 없으면 안내 팝업 후 로그인 화면으로 복귀
- 회원가입 후에도 일반 사용자 계정이면 관리자 진입 차단
- 메인 페이지의 `관리자 포털` 버튼으로 로그인 유지 상태에서 `/admin` 재진입 가능
- 테스트용 개발 관리자 계정 연동

## 테스트용 관리자 계정

백엔드 기본 개발 설정에서는 서버 시작 시 아래 계정이 생성되거나 관리자 계정으로 승격됩니다.

```text
email: dev-admin@local.test
password: Admin1234!
roles: USER, ORGANIZER, ADMIN, VALIDATOR
```

백엔드 서버가 이미 실행 중이었다면 재시작해야 계정 bootstrap이 반영됩니다.

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

프론트 타입 체크:

```bash
cd frontend
npx tsc -p tsconfig.app.json --noEmit --incremental false
```

백엔드 컴파일:

```bash
cd backend
./gradlew compileKotlin
```