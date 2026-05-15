import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backendApi } from "../lib/backend";

export function RegisterPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setError(null);
      await backendApi.registerEmail({ displayName, email, password });
      navigate("/user");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Register failed");
    }
  }

  return (
    <section className="panel">
      <h2>Sign up</h2>
      <form className="form" onSubmit={onSubmit}>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name"
        />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button className="button primary" type="submit">
          Create account
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
