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

    expect(
      screen.getByText(/On-chain trust, off-chain speed for ticketing/i),
    ).toBeInTheDocument();
  });
});