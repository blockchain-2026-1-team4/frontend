import { Link, useRoutes } from "react-router-dom";
import { appRoutes } from "./routes";

function App() {
  const routes = useRoutes(appRoutes);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          TRUST TICKET
        </Link>
      </header>
      <main className="content">{routes}</main>
    </div>
  );
}

export default App;
