import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "./providers";

const navigation = vi.hoisted(() => ({ pathname: "/analytics" }));
const mounted = vi.hoisted(() => ({ session: vi.fn(), theme: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/lib/session", () => ({ SessionProvider: ({ children }: { children: ReactNode }) => { mounted.session(); return children; } }));
vi.mock("@/lib/theme", () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => { mounted.theme(); return children; } }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("public snapshot provider boundary", () => {
  it.each(["/shared-progress", "/shared-progress/"])("does not initialize account or preference providers at %s", (pathname) => {
    navigation.pathname = pathname;
    render(<Providers><h1>Public snapshot</h1></Providers>);
    expect(screen.getByRole("heading", { name: "Public snapshot" })).toBeVisible();
    expect(mounted.session).not.toHaveBeenCalled();
    expect(mounted.theme).not.toHaveBeenCalled();
  });

  it("restores application providers when navigating back into the application", () => {
    navigation.pathname = "/shared-progress";
    const { rerender } = render(<Providers><h1>Page</h1></Providers>);
    navigation.pathname = "/login";
    rerender(<Providers><h1>Page</h1></Providers>);
    expect(mounted.session).toHaveBeenCalledOnce();
    expect(mounted.theme).toHaveBeenCalledOnce();
  });
});
