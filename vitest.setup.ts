import "@testing-library/jest-dom/vitest";
import { format } from "node:util";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom/React-18-artifact: Next 14's bundled React (compiled via Next's build
// pipeline) supports passing a function to <form action={fn}> — this is an
// existing app convention (see e.g. task-checklist.tsx, project-links.tsx).
// Outside that pipeline, vanilla react-dom under Vitest/jsdom doesn't
// recognize function form actions and logs a console.error warning. React
// logs this as a `%s`-style format string plus separate args (e.g. "action",
// "form"), so we format the message the same way console.error/Node would
// before matching, then suppress only that exact message so real
// warnings/errors still surface.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = typeof args[0] === "string" ? format(...(args as [string, ...unknown[]])) : "";
  if (message.includes("Invalid value for prop `action` on <form> tag")) return;
  originalConsoleError(...args);
};
