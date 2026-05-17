import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backendApi } from "../lib/backend";
import { requireAdminPath } from "../lib/authRoute";

function getServerMessage(cause: unknown) {
  if (!cause || typeof cause !== "object") {
    return undefined;
  }

  const response = (cause as { response?: { data?: { message?: string } } }).response;
  return response?.data?.message;
}

function buildRegisterError(cause: unknown) {
  if (cause instanceof Error && cause.message.includes("ADMIN 계정")) {
    return cause.message;
  }

  return getServerMessage(cause) || "회원가입에 실패했습니다. 입력값을 확인하고 다시 시도하세요.";
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      setError(null);
      await backendApi.registerEmail({ displayName, email, password });
      navigate(await requireAdminPath(), { replace: true });
    } catch (cause) {
      const message = buildRegisterError(cause);
      if (message.includes("ADMIN 계정")) {
        window.alert("회원가입은 일반 USER 계정으로 생성됩니다. 관리자 페이지는 ADMIN 계정으로 로그인해야 합니다.");
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <h2>회원가입</h2>
      <form className="form" onSubmit={onSubmit}>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="표시 이름"
        />
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일" />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호"
        />
        <button className="button primary" disabled={submitting} type="submit">
          {submitting ? "확인 중..." : "계정 만들기"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
