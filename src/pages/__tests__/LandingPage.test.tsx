import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "../LandingPage";

describe("LandingPage", () => {
  it("renders project tagline", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/블록체인 기반 티켓 관리자 콘솔/i)).toBeInTheDocument();
  });
});
