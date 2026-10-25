// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toggleEpisodeAction = vi.fn();
const markSeasonAction = vi.fn();
const toastError = vi.fn();
const refresh = vi.fn();

vi.mock("@/features/progress/actions/progress-actions", () => ({
  toggleEpisodeAction: (...a: unknown[]) => toggleEpisodeAction(...a),
  markSeasonAction: (...a: unknown[]) => markSeasonAction(...a),
  rateSeasonAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

import { SeasonsAccordion } from "./seasons-accordion";
import { SeasonsList } from "./seasons-list";

const seasons = [
  {
    id: "s1",
    seasonNumber: 1,
    name: "Temporada 1",
    episodes: [
      {
        id: "e1",
        episodeNumber: 1,
        name: "Piloto",
        airDate: new Date("2020-01-01T00:00:00Z"),
        runtime: 45,
      },
      {
        id: "e2",
        episodeNumber: 2,
        name: "Futuro",
        airDate: new Date("2999-01-01T00:00:00Z"),
        runtime: null,
      },
      { id: "e3", episodeNumber: 3, name: "Sem data", airDate: null, runtime: null },
    ],
  },
];

const user = { watchedEpisodeIds: [] as string[], seasonRatings: {} };
/** Episode rows render lazily, once their season is opened. */
const openSeason = () => {
  const details = document.querySelector("details") as HTMLDetailsElement;
  details.open = true;
  fireEvent(details, new Event("toggle"));
};
const checkbox = (name: RegExp) => screen.getByRole("checkbox", { name }) as HTMLInputElement;

beforeEach(() => {
  toggleEpisodeAction.mockReset();
  markSeasonAction.mockReset();
  toastError.mockReset();
  refresh.mockReset();
});
afterEach(cleanup);

describe("<SeasonsAccordion />", () => {
  it("LOG-13 reverts the checkbox and shows a toast when the server fails", async () => {
    let fail!: (v: unknown) => void;
    toggleEpisodeAction.mockReturnValue(new Promise((r) => (fail = r)));
    render(<SeasonsAccordion seasons={seasons} user={user} />);
    openSeason();

    const box = checkbox(/Piloto/);
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    // Optimistic: checked immediately, before the server answers.
    await waitFor(() => expect(box.checked).toBe(true));

    fail({ ok: false, error: { code: "INTERNAL", message: "x" } });
    await waitFor(() => expect(box.checked).toBe(false));
    expect(toastError).toHaveBeenCalledWith("Não foi possível salvar");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders episode rows only after their season is opened (keeps big series cheap to hydrate)", () => {
    render(<SeasonsAccordion seasons={seasons} user={user} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    openSeason();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("keeps the checkbox checked and refreshes when the server succeeds", async () => {
    toggleEpisodeAction.mockResolvedValue({
      ok: true,
      data: { progress: {}, promptCompletion: false },
    });
    render(<SeasonsAccordion seasons={seasons} user={user} />);
    openSeason();
    const box = checkbox(/Piloto/);
    fireEvent.click(box);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(box.checked).toBe(true);
    expect(toggleEpisodeAction).toHaveBeenCalledWith("e1", true);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("LOG-07 unaired and undated episodes are disabled with a tooltip", () => {
    render(<SeasonsAccordion seasons={seasons} user={user} />);
    openSeason();
    for (const name of [/Futuro/, /Sem data/]) {
      const box = checkbox(name);
      expect(box.disabled).toBe(true);
      expect(box.closest("span")?.getAttribute("title")).toBe("Ainda não foi ao ar");
    }
    expect(checkbox(/Piloto/).disabled).toBe(false);
  });

  it("LOG-06 'mark season' checks only aired episodes and reverts on failure", async () => {
    markSeasonAction.mockResolvedValue({ ok: false, error: { code: "INTERNAL", message: "x" } });
    render(<SeasonsAccordion seasons={seasons} user={user} />);
    openSeason();
    fireEvent.click(screen.getByRole("button", { name: "Marcar temporada como assistida" }));
    await waitFor(() => expect(markSeasonAction).toHaveBeenCalledWith("s1", true));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(checkbox(/Piloto/).checked).toBe(false);
  });

  it("logged-out visitors get a read-only server-rendered list (no checkboxes or buttons)", () => {
    render(<SeasonsList seasons={seasons} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Marcar temporada/ })).toBeNull();
    expect(screen.getByText("Piloto")).toBeTruthy();
  });

  it("shows my season rating on the season header", () => {
    render(
      <SeasonsAccordion
        seasons={seasons}
        user={{ ...user, seasonRatings: { s1: { rating: 4, reviewText: null } } }}
      />,
    );
    expect(screen.getByRole("img", { name: "4,0 de 5 estrelas" })).toBeTruthy();
  });
});
