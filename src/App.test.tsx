import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/HunterScene", () => ({
  HunterScene: () => <div data-testid="mock-hunter-scene" />
}));

describe("App", () => {
  it("renders the product shell and scenario story", () => {
    render(<App />);

    expect(screen.getByText("A Capital Hunter")).toBeInTheDocument();
    expect(screen.getByText("AI算力领涨，光模块、CPO、液冷服务器共振。")).toBeInTheDocument();
    expect(screen.getByLabelText("A Capital Hunter 3D资金峰面")).toBeInTheDocument();
  });

  it("switches the active time slice story", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "T4 低空经济主升" }));

    expect(screen.getByText("低空经济成为主峰，AI与机器人部分流出或震荡。")).toBeInTheDocument();
  });
});
