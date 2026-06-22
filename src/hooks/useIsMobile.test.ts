import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "./useIsMobile";

type Listener = () => void;

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();
  const mql = {
    get matches() { return matches; },
    media: "",
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
  };
  const set = (v: boolean) => { matches = v; listeners.forEach((cb) => cb()); };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
  return { set };
}

describe("useIsMobile", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns the initial match state", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("updates when the media query flips", () => {
    const { set } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => set(true));
    expect(result.current).toBe(true);
  });
});
