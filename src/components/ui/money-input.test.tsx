import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MoneyInput } from "./money-input";

function hidden(container: HTMLElement) {
  return container.querySelector('input[type="hidden"][name="budget"]') as HTMLInputElement;
}

describe("MoneyInput", () => {
  it("shows the default value grouped and submits the plain number", () => {
    const { container } = render(<MoneyInput aria-label="Presupuesto" name="budget" defaultValue="100000.00" />);
    expect(screen.getByLabelText("Presupuesto")).toHaveValue("100,000");
    expect(hidden(container)).toHaveValue("100000");
  });

  it("groups while typing and pads cents on blur", () => {
    const { container } = render(<MoneyInput aria-label="Presupuesto" name="budget" />);
    const input = screen.getByLabelText("Presupuesto");
    fireEvent.change(input, { target: { value: "1234567.5" } });
    expect(input).toHaveValue("1,234,567.5");
    fireEvent.blur(input);
    expect(input).toHaveValue("1,234,567.50");
    expect(hidden(container)).toHaveValue("1234567.50");
  });
});
