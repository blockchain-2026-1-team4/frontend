import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { EventSummary } from "../../types/api";

export function UserHomePage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [keyword, setKeyword] = useState("");

  async function loadEvents(search?: string) {
    const data = await backendApi.getEvents({ query: search });
    setEvents(data.items ?? []);
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  return (
    <section className="panel">
      <h2>사용자 메인</h2>
      <p className="lead">이벤트를 검색하고, 카테고리를 둘러보고, 내 페이지로 이동합니다.</p>
      <div className="row">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="이벤트 검색"
        />
        <button className="button" onClick={() => void loadEvents(keyword)}>
          검색
        </button>
      </div>
      <div className="card-grid">
        {events.map((event) => (
          <Link key={event.id} className="event-card" to={`/app/events/${event.id}`}>
            <h3>{event.title}</h3>
            <p>{event.venue}</p>
            <p>{new Date(event.eventDateTime).toLocaleString()}</p>
            <p>{event.status}</p>
          </Link>
        ))}
      </div>
      <div className="action-row">
        <Link className="button" to="/app/events">
          이벤트 목록
        </Link>
        <Link className="button" to="/app/resale">
          리셀 마켓
        </Link>
        <Link className="button" to="/app/me">
          내 페이지
        </Link>
        <Link className="button" to="/app/tickets">
          내 티켓
        </Link>
      </div>
    </section>
  );
}
