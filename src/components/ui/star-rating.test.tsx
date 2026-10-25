// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyRatingKey, nextRatingOnStarClick } from "@/lib/domain/rating";
import { StarRating } from "./star-rating";

afterEach(cleanup);

function Harness({
  initial = null,
  clearable = true,
}: {
  initial?: number | null;
  clearable?: boolean;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return <StarRating value={value} onChange={setValue} clearable={clearable} />;
}

const slider = () => screen.getByRole("slider");
const star = (n: number) => document.querySelector(`[data-star="${n}"]`) as HTMLElement;

describe("rating helpers", () => {
  it("LOG-02 clicking the 4th star twice goes 4 → 3.5, and a third click returns to 4", () => {
    let v: number | null = null;
    v = nextRatingOnStarClick(v, 4);
    expect(v).toBe(4);
    v = nextRatingOnStarClick(v, 4);
    expect(v).toBe(3.5);
    v = nextRatingOnStarClick(v, 4);
    expect(v).toBe(4);
  });

  it("clicking star 1 twice yields 0.5", () => {
    expect(nextRatingOnStarClick(nextRatingOnStarClick(null, 1), 1)).toBe(0.5);
  });

  it("keyboard steps by 0.5 and clamps", () => {
    expect(applyRatingKey(null, "ArrowRight", true)).toBe(0.5);
    expect(applyRatingKey(4.5, "ArrowRight", true)).toBe(5);
    expect(applyRatingKey(5, "ArrowUp", true)).toBe(5);
    expect(applyRatingKey(4, "ArrowLeft", true)).toBe(3.5);
    expect(applyRatingKey(0.5, "ArrowDown", true)).toBeNull();
    expect(applyRatingKey(0.5, "ArrowDown", false)).toBe(0.5);
    expect(applyRatingKey(3, "End", true)).toBe(5);
    expect(applyRatingKey(3, "Home", true)).toBeNull();
    expect(applyRatingKey(3, "Home", false)).toBe(0.5);
    expect(applyRatingKey(3, "a", true)).toBeUndefined();
  });
});

describe("<StarRating />", () => {
  it("exposes slider semantics with a pt-BR aria-valuetext", () => {
    render(<Harness initial={4.5} />);
    expect(slider()).toHaveProperty("tabIndex", 0);
    expect(slider().getAttribute("aria-valuemin")).toBe("0");
    expect(slider().getAttribute("aria-valuemax")).toBe("5");
    expect(slider().getAttribute("aria-valuenow")).toBe("4.5");
    expect(slider().getAttribute("aria-valuetext")).toBe("4,5 de 5 estrelas");
  });

  it("describes an empty rating", () => {
    render(<Harness />);
    expect(slider().getAttribute("aria-valuetext")).toBe("Sem avaliação");
    expect(slider().getAttribute("aria-valuenow")).toBe("0");
  });

  it("changes with the keyboard", () => {
    render(<Harness initial={3} />);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(slider().getAttribute("aria-valuetext")).toBe("3,5 de 5 estrelas");
    fireEvent.keyDown(slider(), { key: "End" });
    expect(slider().getAttribute("aria-valuetext")).toBe("5,0 de 5 estrelas");
    fireEvent.keyDown(slider(), { key: "Home" });
    expect(slider().getAttribute("aria-valuetext")).toBe("Sem avaliação");
  });

  it("changes with clicks (4th star twice → 3.5)", () => {
    render(<Harness />);
    fireEvent.click(star(4));
    expect(slider().getAttribute("aria-valuetext")).toBe("4,0 de 5 estrelas");
    fireEvent.click(star(4));
    expect(slider().getAttribute("aria-valuetext")).toBe("3,5 de 5 estrelas");
  });

  it("can be cleared with the button when clearable", () => {
    render(<Harness initial={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar nota" }));
    expect(slider().getAttribute("aria-valuenow")).toBe("0");
    expect(screen.queryByRole("button", { name: "Limpar nota" })).toBeNull();
  });

  it("hides the clear button when not clearable", () => {
    render(<Harness initial={2} clearable={false} />);
    expect(screen.queryByRole("button", { name: "Limpar nota" })).toBeNull();
  });

  it("read-only renders an image with the rating text and no slider", () => {
    render(<StarRating value={3.5} readOnly />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("3,5 de 5 estrelas");
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("ignores input while disabled", () => {
    const onChange = vi.fn();
    render(<StarRating value={2} onChange={onChange} disabled />);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    fireEvent.click(star(5));
    expect(onChange).not.toHaveBeenCalled();
  });
});
