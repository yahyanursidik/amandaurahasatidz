import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("eager portal history bridge for lazy profile editor", () => {
  it("installs one early listener, forwards only the current editor, and ignores stale cleanup", async () => {
    const addEventListener = vi.fn();
    vi.stubGlobal("window", { addEventListener });
    const { registerProfilePopHandler } = await import("../../src/lib/portalNavigationGuard");
    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener.mock.calls[0][0]).toBe("popstate");
    expect(addEventListener.mock.calls[0][2]).toBe(true);
    const dispatch = addEventListener.mock.calls[0][1] as (event: PopStateEvent) => void;
    const event = { state: { idx: 1 } } as PopStateEvent;
    expect(() => dispatch(event)).not.toThrow();
    const first = vi.fn(), second = vi.fn();
    const clearFirst = registerProfilePopHandler(first);
    dispatch(event);
    expect(first).toHaveBeenCalledWith(event);
    const clearSecond = registerProfilePopHandler(second);
    clearFirst();
    dispatch(event);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    clearSecond();
    dispatch(event);
    expect(second).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledTimes(1);
  });

  it("is safe to import while rendering on the server", async () => {
    vi.stubGlobal("window", undefined);
    const { registerProfilePopHandler } = await import("../../src/lib/portalNavigationGuard");
    expect(registerProfilePopHandler(vi.fn())).toBeTypeOf("function");
  });
});