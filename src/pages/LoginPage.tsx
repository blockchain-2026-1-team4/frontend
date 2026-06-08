import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backendApi } from "../lib/backend";
import { requireAdminPath } from "../lib/authRoute";

function getHttpStatus(cause: unknown) {
  if (!cause || typeof cause !== "object") {
    return undefined;
  }

  return (cause as { response?: { status?: number } }).response?.status;
}

function getServerMessage(cause: unknown) {
  if (!cause || typeof cause !== "object") {
    return undefined;
  }

  return (cause as { response?: { data?: { message?: string } } }).response?.data?.message;
}

function buildLoginError(cause: unknown) {
  const status = getHttpStatus(cause);
  const serverMessage = getServerMessage(cause);

  if (status === 401 || status === 403) {
    return serverMessage || "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  if (cause instanceof Error && cause.message) {
    return cause.message;
  }

  return serverMessage || "관리자 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(import.meta.env.DEV ? "dev-admin@local.test" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "Admin1234!" : "");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await backendApi.loginEmail({ email, password });
      navigate(await requireAdminPath(), { replace: true });
    } catch (cause) {
      setError(buildLoginError(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-access-page">
      <header className="admin-access-header">
        <div className="brand">
          <div className="logo">TT</div>
          <span>TRUST TICKET</span>
        </div>
        <div className="header-note">관리자 전용 웹 콘솔</div>
      </header>

      <main className="admin-access-main">
        <section className="intro">
          <div className="intro-content">
            <div className="kicker">Admin Access</div>
            <h1>
              플랫폼 운영을 위한
              <br />
              관리자 센터
            </h1>

            <p className="desc">
              승인된 관리자만 접근할 수 있습니다.
              <br />
              로그인 후 주최자 승인, 이벤트 검수, 회원 권한 관리,
              <br />
              분쟁 및 리셀 거래 검토, 블록체인 처리 로그를 확인할 수 있습니다.
            </p>

            <div className="scope">
              <div className="scope-card">
                <i className="ti ti-user-check" />
                <div className="scope-title">주최자 승인</div>
                <div className="scope-sub">신청 정보와 상태를 검토하고 승인 또는 거절합니다.</div>
              </div>
              <div className="scope-card">
                <i className="ti ti-calendar-search" />
                <div className="scope-title">이벤트 검수</div>
                <div className="scope-sub">운영 중인 이벤트의 검수, 취소, 활성 상태를 관리합니다.</div>
              </div>
              <div className="scope-card">
                <i className="ti ti-message-report" />
                <div className="scope-title">분쟁 및 리셀 검토</div>
                <div className="scope-sub">신고된 분쟁과 리셀 거래 이력을 모니터링합니다.</div>
              </div>
              <div className="scope-card">
                <i className="ti ti-database" />
                <div className="scope-title">블록체인 처리 로그</div>
                <div className="scope-sub">티켓 발행, 거래, 체크인 관련 온체인 기록을 추적합니다.</div>
              </div>
            </div>
          </div>
        </section>

        <aside className="login">
          <div className="login-head">
            <div className="pill">
              <i className="ti ti-lock-check" />
              관리자 계정
            </div>
            <h2>관리자 로그인</h2>
            <p className="login-sub">관리자 계정으로 로그인하면 Trust Ticket 관리자 콘솔을 사용할 수 있습니다.</p>
          </div>

          <form className="form" onSubmit={onSubmit}>
            <div className="field">
              <label>
                이메일 <span>Admin ID</span>
              </label>
              <div className="input-wrap">
                <i className="ti ti-mail" />
                <input
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="dev-admin@local.test"
                />
              </div>
            </div>

            <div className="field">
              <label>
                비밀번호 <span>Password</span>
              </label>
              <div className="input-wrap">
                <i className="ti ti-key" />
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="비밀번호"
                />
              </div>
            </div>

            <div className="row login-row">
              <button className="check" type="button" onClick={() => setKeepSignedIn((value) => !value)}>
                <span className="check-box">{keepSignedIn ? "✓" : ""}</span>
                로그인 상태 유지
              </button>
              <span className="help-link">접근 권한 문의</span>
            </div>

            <button className="btn btn-login" disabled={submitting} type="submit">
              {submitting ? "확인 중..." : "로그인"}
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}

          <div className="notice">
            <i className="ti ti-shield-lock" />
            <div>
              <div className="notice-title">보안 안내</div>
              <div className="notice-sub">
                관리자 콘솔은 승인된 계정만 접근할 수 있습니다. 운영 환경에서는 2차 인증과 접근 로그 기록을 권장합니다.
              </div>
            </div>
          </div>

          <div className="footer">
            <span>Admin Console</span>
            <span>Secure Login</span>
          </div>
        </aside>
      </main>
    </div>
  );
}
