import React, { lazy } from "react";
import { PassThrough } from "node:stream";
import { readFileSync } from "node:fs";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary, RouteLoadingBoundary } from "../../src/components/common/RouteLoadingBoundary";

const session = vi.hoisted(() => ({ path: "/", authenticated: true, role: "SUPER_ADMIN" }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) =>
      <StaticRouter location={session.path}>{children}</StaticRouter>,
    // This SPA's redirects run on the client. In SSR tests, serialize the
    // redirect intent instead of attempting navigation in a static router.
    Navigate: ({ to }: { to: string }) => <div data-redirect={to} />,
  };
});
vi.mock("@refinedev/core", () => ({
  Refine: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useIsAuthenticated: () => ({ data: { authenticated: session.authenticated }, isLoading: false }),
  useGetIdentity: () => ({ data: { assignments: [{ roleCode: session.role }] }, isLoading: false }),
}));

// Use the existing node/SSR test setup: no DOM dependency or real API calls.
function stream(element: React.ReactElement) {
  const output = new PassThrough();
  let html = "";
  let shellReady!: () => void;
  const shell = new Promise<void>((resolve) => { shellReady = resolve; });
  const done = new Promise<string>((resolve, reject) => {
    output.on("data", (chunk) => { html += chunk.toString(); });
    output.on("end", () => resolve(html));
    output.on("error", reject);
  });
  const rendering = renderToPipeableStream(element, {
    onShellReady: () => { rendering.pipe(output); shellReady(); },
    onShellError: (error) => output.destroy(error as Error),
  });
  return { shell, done, html: () => html, abort: rendering.abort };
}

const appSource = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const loaders = [...appSource.matchAll(/const (\w+) = lazy\(\(\) => import\("(\.\/[^"\n]+)"\)/g)];

let consoleError: ReturnType<typeof vi.spyOn>;
let consoleWarn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error");
  consoleWarn = vi.spyOn(console, "warn");
});
afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  expect(consoleWarn).not.toHaveBeenCalled();
  consoleError.mockRestore();
  consoleWarn.mockRestore();
  for (const [, , modulePath] of loaders) vi.doUnmock(`../../src/${modulePath.slice(2)}`);
  vi.resetModules();
  vi.unstubAllGlobals();
  session.authenticated = true;
  session.role = "SUPER_ADMIN";
});

describe("lazy route loading", () => {
  it("keeps all page modules and the check-in layout behind literal lazy imports", () => {
    expect(loaders).toHaveLength(42);
    expect(appSource).not.toMatch(/import\s+.*from\s+["']\.\/pages\//);
    expect(loaders.map(([, name]) => name)).toContain("CommitteeLayout");
  });

  it.each([
    ["/", "PublicProgramsPage", "SUPER_ADMIN"],
    ["/programs", "PublicProgramsPage", "SUPER_ADMIN"],
    ["/ruang-asatidz", "RuangAsatidzPublicPage", "USTADZ"],
    ["/admin/peta-ukhuwah", "UkhuwahPage", "SYSTEM_ADMIN"],
    ["/portal/peta-ukhuwah", "UkhuwahPage", "USTADZ"],
    ["/login/committee", "LoginPage", "SUPER_ADMIN"],
    ["/gate/event-a", "CheckInPublicPage", "SUPER_ADMIN"],
    ["/invitation/institution/slug/token", "InvitationRegistrationPage", "SUPER_ADMIN"],
    ["/admin/events/event-a/reports", "EventOperationsPage", "SUPER_ADMIN"],
    ["/admin/broadcast", "AdminEmailJobsPage", "SUPER_ADMIN"],
    ["/committee/check-in", "OnSiteCheckinPage", "CHECKIN_OFFICER"],
    ["/committee/announcements", "CommitteeOperationsPage", "CHECKIN_OFFICER"],
    ["/portal/ruang-asatidz/saran", "RuangAsatidzPage", "USTADZ"],
    ["/admin/ruang-asatidz/moderasi", "RuangAsatidzAdminPage", "SUPER_ADMIN"],
    ["/portal/schedule", "ParticipantPortalPage", "USTADZ"],
    ["/not-a-route", "NotFoundPage", "SUPER_ADMIN"],
  ])("loads only the matched page at %s", async (path, page, role) => {
    session.path = path;
    session.role = role;
    const loaded: string[] = [];
    for (const [, name, modulePath] of loaders) {
      vi.doMock(`../../src/${modulePath.slice(2)}`, () => {
        loaded.push(name);
        return { [name]: ({ children, mode }: { children?: React.ReactNode; mode?: string }) =>
          <div data-page={name} data-mode={mode}>{children}</div> };
      });
    }
    const { App } = await import("../../src/App");
    expect(loaded).toEqual([]);
    const html = await stream(<App />).done;
    expect(html).toContain(`data-page="${page}"`);
    expect(loaded.sort()).toEqual((page === "OnSiteCheckinPage" ? ["CommitteeLayout", page] : [page]).sort());
    if (path.endsWith("/reports")) expect(html).toContain('data-mode="reports"');
    if (path.endsWith("/broadcast")) expect(html).toContain('data-mode="broadcast"');
    if (path.endsWith("/announcements")) expect(html).toContain('data-mode="announcements"');
  // The first App import transforms the full shell on a cold Windows worker.
  // Keep a bounded timeout without weakening the lazy-loading assertions.
  }, 15000);

  it("loads the public Ruang page without authentication or private portal modules", async () => {
    session.path = "/ruang-asatidz";
    session.authenticated = false;
    session.role = "";
    const loaded: string[] = [];
    for (const [, name, modulePath] of loaders) {
      vi.doMock(`../../src/${modulePath.slice(2)}`, () => {
        loaded.push(name);
        return { [name]: () => <div data-page={name} /> };
      });
    }
    const { App } = await import("../../src/App");
    const html = await stream(<App />).done;
    expect(html).toContain('data-page="RuangAsatidzPublicPage"');
    expect(html).not.toContain("data-redirect");
    expect(loaded).toEqual(["RuangAsatidzPublicPage"]);
  });

  it.each([false, true])("does not import an admin page when the guard denies access (authenticated: %s)", async (authenticated) => {
    session.path = "/admin";
    session.authenticated = authenticated;
    session.role = "USTADZ";
    const loaded = vi.fn();
    vi.doMock("../../src/pages/admin/AdminDashboardPage", () => {
      loaded();
      return { AdminDashboardPage: () => <div>Admin content</div> };
    });
    const { App } = await import("../../src/App");
    const html = await stream(<App />).done;
    expect(loaded).not.toHaveBeenCalled();
    expect(html).not.toContain("Admin content");
    expect(html).toContain(`data-redirect="${authenticated ? "/portal" : "/login/admin"}"`);
  });

  it("announces a pending chunk and renders the page when it resolves", async () => {
    let resolve!: (module: { default: React.FC }) => void;
    const load = vi.fn(() => new Promise<{ default: React.FC }>((done) => { resolve = done; }));
    const Page = lazy(load);
    const rendering = stream(<StaticRouter location="/"><RouteLoadingBoundary><Page /></RouteLoadingBoundary></StaticRouter>);
    try {
      await rendering.shell;
      expect(rendering.html()).toContain('role="status"');
      expect(rendering.html()).toContain('aria-live="polite"');
      expect(rendering.html()).toContain("Memuat halaman…");
      expect(rendering.html()).not.toContain("Loaded route");
      resolve({ default: () => <h1>Loaded route</h1> });
      expect(await rendering.done).toContain("Loaded route");
      expect(load).toHaveBeenCalledTimes(1);
    } finally { rendering.abort(); }
  });
});

describe("route chunk failure recovery", () => {
  it("offers an accessible manual reload only after an error, without leaking error details", () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    const boundary = new RouteErrorBoundary({ children: <p>Healthy route</p>, resetKey: "route-a" });
    expect(renderToStaticMarkup(boundary.render() as React.ReactElement)).toContain("Healthy route");
    boundary.state = { ...boundary.state, ...RouteErrorBoundary.getDerivedStateFromError() };
    const fallback = boundary.render() as React.ReactElement;
    const html = renderToStaticMarkup(<StaticRouter location="/">{fallback}</StaticRouter>);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Halaman tidak dapat dimuat");
    expect(html).toContain("Data yang belum disimpan mungkin hilang");
    expect(html).toContain('href="/programs"');
    expect(reload).not.toHaveBeenCalled();
    const button = React.Children.toArray(fallback.props.children).find((child) => React.isValidElement(child) && child.type === "button") as React.ReactElement<{ onClick: () => void }>;
    button.props.onClick();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(RouteErrorBoundary.getDerivedStateFromProps(boundary.props, boundary.state)).toBeNull();
    const reset = RouteErrorBoundary.getDerivedStateFromProps({ ...boundary.props, resetKey: "route-b" }, boundary.state);
    expect(reset).toEqual({ hasError: false, resetKey: "route-b" });
    boundary.state = { ...boundary.state, ...reset };
    expect(renderToStaticMarkup(boundary.render() as React.ReactElement)).toContain("Healthy route");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});