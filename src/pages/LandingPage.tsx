import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Trust Ticket</p>
        <h1>블록체인 기반 티켓 관리자 콘솔</h1>
        <p className="lead">
          관리자는 웹 포털에서 주최자 승인, 이벤트 감독, 사용자 관리,
          <br />
          분쟁·리셀 거래 검토와 블록체인 로그 확인 업무를 처리합니다.
        </p>
      </div>
      <div className="action-row">
        <Link className="button primary" to="/login">
          관리자 로그인
        </Link>
        <Link className="button" to="/admin">
          관리자 대시보드 열기
        </Link>
      </div>
    </section>
  );
}
