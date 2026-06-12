import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/HunterScene", () => ({
  HunterScene: () => <div data-testid="mock-hunter-scene" />
}));

describe("App", () => {
  it("renders the product shell and header", () => {
    render(<App />);

    expect(screen.getByText("A Capital Hunter")).toBeInTheDocument();
    expect(screen.getByLabelText("A Capital Hunter 3D资金峰面")).toBeInTheDocument();
  });

  it("renders period selector buttons", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "今日" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "近5日" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "近10日" })).toBeInTheDocument();
  });
});
