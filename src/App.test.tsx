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
    expect(screen.getByText("AI算力与半导体供应链共振，硬科技主线靠近视觉中心。")).toBeInTheDocument();
    expect(screen.getByLabelText("A Capital Hunter 3D资金峰面")).toBeInTheDocument();
  });

  it("switches the active time slice story", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "新能源/军工轮动" }));

    expect(screen.getByText("新能源与军工航天获得资金关注，前期科技主线进入整理。")).toBeInTheDocument();
  });
});
