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

    expect(screen.getByText(/관리자 전용 웹 콘솔/i)).toBeInTheDocument();
  });
});
