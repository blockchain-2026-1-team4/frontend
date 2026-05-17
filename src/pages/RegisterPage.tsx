import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backendApi } from "../lib/backend";
import { resolveRolePath } from "../lib/authRoute";

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
      navigate(await resolveRolePath());
    } catch (e) {
      setError(e instanceof Error ? e.message : "회원가입에 실패했습니다.");
    }
  }

  return (
    <section className="panel">
      <h2>회원가입</h2>
      <form className="form" onSubmit={onSubmit}>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="표시 이름"
        />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
        />
        <button className="button primary" type="submit">
          계정 만들기
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
