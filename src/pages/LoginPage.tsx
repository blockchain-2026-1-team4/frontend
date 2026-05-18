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
    return serverMessage || "Email or password is invalid.";
  }

  return serverMessage || "Admin login failed. Please try again.";
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
      const message = cause instanceof Error && cause.message.includes("ADMIN account")
        ? cause.message
        : buildLoginError(cause);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <h2>Admin Login</h2>
      <p className="lead">Sign in with an administrator account to use the web console.</p>
      <form className="form" onSubmit={onSubmit}>
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />
        <button className="button primary" disabled={submitting} type="submit">
          {submitting ? "Checking..." : "Log in"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
