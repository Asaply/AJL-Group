import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// A mutable "current URL" the mocked next/navigation hooks read from/write to,
// so a test can simulate the browser applying a router.replace() and then
// hand the component a fresh render that sees the new searchParams — exactly
// like a real Next.js navigation would.
// `useSearchParams()` in real Next.js returns a referentially stable object
// that only changes identity when the URL actually changes navigation — it
// does NOT get a fresh instance on every unrelated re-render. We mirror that
// here (only rebuilding the URLSearchParams when the search string actually
// changes) so effects keyed on `[searchParams]` behave the same as in the app.
const nav = vi.hoisted(() => {
  let search = "";
  let params = new URLSearchParams(search);
  function setSearch(next: string) {
    if (next === search) return;
    search = next;
    params = new URLSearchParams(search);
  }
  return {
    replace: vi.fn((url: string) => {
      const qIndex = url.indexOf("?");
      setSearch(qIndex >= 0 ? url.slice(qIndex + 1) : "");
    }),
    setSearch,
    getSearch: () => search,
    getParams: () => params,
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/clients",
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => nav.getParams(),
}));

// Radix's Select requires browser layout APIs (hasPointerCapture,
// scrollIntoView, ResizeObserver) that jsdom doesn't implement, and this repo
// has no existing precedent for driving it in tests. We swap in a native
// <select> that preserves the same value/onValueChange contract so the
// "change status" step can fire synchronously via fireEvent.change.
vi.mock("@/components/ui/select", () => {
  function Select({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) {
    return (
      <select value={value} onChange={(e) => onValueChange(e.target.value)}>
        {children}
      </select>
    );
  }
  function Passthrough({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  function SelectItem({ value, children }: { value: string; children: ReactNode }) {
    return <option value={value}>{children}</option>;
  }
  return {
    Select,
    SelectTrigger: Passthrough,
    SelectContent: Passthrough,
    SelectValue: () => null,
    SelectItem,
  };
});

import { ClientFilters } from "./client-filters";

beforeEach(() => {
  vi.useFakeTimers();
  nav.replace.mockClear();
  nav.setSearch("");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ClientFilters", () => {
  it("does not drop a status change applied while a search debounce is pending", async () => {
    const { rerender } = render(<ClientFilters industries={[]} />);

    // A real user typing into the field focuses it first; this matters here
    // because the URL-resync effect must not clobber unsaved input while the
    // field is focused (see the second test below).
    const input = screen.getByLabelText("Buscar cliente o contacto") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "abc" } });

    // Change the status filter before the 300ms debounce for `q` elapses.
    // This applies immediately and updates the URL.
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "active" } });
    expect(nav.getSearch()).toBe("status=active");

    // Simulate Next.js re-rendering the (still-mounted) component with the
    // new searchParams after that navigation — this is what makes the fix's
    // ref observable versus the old stale closure.
    rerender(<ClientFilters industries={[]} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    const lastUrl = nav.replace.mock.calls[nav.replace.mock.calls.length - 1][0] as string;
    const finalParams = new URLSearchParams(lastUrl.split("?")[1] ?? "");
    expect(finalParams.get("q")).toBe("abc");
    expect(finalParams.get("status")).toBe("active");
  });

  it("resyncs the search input from the URL on external navigation, but not while typing", () => {
    const { rerender } = render(<ClientFilters industries={[]} />);
    const input = screen.getByLabelText("Buscar cliente o contacto") as HTMLInputElement;
    expect(input.value).toBe("");

    nav.setSearch("q=hello");
    rerender(<ClientFilters industries={[]} />);
    expect(input.value).toBe("hello");

    input.focus();
    nav.setSearch("q=world");
    rerender(<ClientFilters industries={[]} />);
    expect(input.value).toBe("hello");
  });
});
