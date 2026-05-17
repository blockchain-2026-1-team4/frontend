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

  const response = (cause as { response?: { data?: { message?: string } } }).response;
  return response?.data?.message;
}

function buildLoginError(cause: unknown) {
  const status = getHttpStatus(cause);
  const serverMessage = getServerMessage(cause);

  if (status === 401 || status === 403) {
    return serverMessage || "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  if (serverMessage) {
    return serverMessage;
  }

  return "로그인에 실패했습니다. 잠시 후 다시 시도하세요.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      setError(null);
      await backendApi.loginEmail({ email, password });
      navigate(await requireAdminPath(), { replace: true });
    } catch (cause) {
      const message = cause instanceof Error && cause.message.includes("ADMIN 계정") ? cause.message : buildLoginError(cause);
      if (message.includes("ADMIN 계정")) {
        window.alert(message);
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <h2>로그인</h2>
      <form className="form" onSubmit={onSubmit}>
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일" />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호"
        />
        <button className="button primary" disabled={submitting} type="submit">
          {submitting ? "확인 중..." : "로그인"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
