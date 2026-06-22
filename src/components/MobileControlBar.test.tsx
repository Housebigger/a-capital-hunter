import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileControlBar } from "./MobileControlBar";

describe("MobileControlBar", () => {
  it("renders window + view controls and fires handlers", () => {
    const onWindowChange = vi.fn();
    const onViewModeChange = vi.fn();
    render(
      <MobileControlBar
        activeWindow="1d"
        onWindowChange={onWindowChange}
        viewMode="P1"
        onViewModeChange={onViewModeChange}
      />
    );
    fireEvent.click(screen.getByText("近10日"));
    expect(onWindowChange).toHaveBeenCalledWith("10d");
    fireEvent.click(screen.getByText("P2 子题材"));
    expect(onViewModeChange).toHaveBeenCalledWith("P2");
  });
});
