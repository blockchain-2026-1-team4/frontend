import { Link, useLocation } from "react-router-dom";

export function LandingPage() {
  const { pathname } = useLocation();
  const isAppStart = pathname.startsWith("/app") || pathname.startsWith("/organizer");

  if (isAppStart) {
    return (
      <div className="mobile-shell">
        <main className="mobile-card">
          <h1>시작 화면</h1>
          <p className="lead">로그인 또는 회원가입을 선택할 수 있는 시작 화면입니다.</p>

          <div className="mobile-actions">
            <Link className="mobile-button primary" to="/login">
              로그인
            </Link>
            <Link className="mobile-button" to="/register">
              회원가입
            </Link>
          </div>

          <div className="mobile-footer">
            <Link to="/app/me">마이페이지</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Trust Ticket</p>
        <h1>블록체인 기반 티켓 예매·관리 플랫폼</h1>
        <p className="lead">
          사용자는 모바일 앱에서 티켓을 예매하고, 주최자는 이벤트를 관리하며,
          <br />
          관리자는 웹 포털에서 승인·감독 업무를 처리합니다.
        </p>
      </div>
      <div className="action-row">
        <Link className="button primary" to="/login">
          로그인
        </Link>
        <Link className="button" to="/register">
          회원가입
        </Link>
      </div>
    </section>
  );
}
