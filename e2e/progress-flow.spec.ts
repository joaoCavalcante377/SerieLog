import { expect, test, type Page } from "@playwright/test";

const SERIES_PATH = "/serie/1396-breaking-bad";

async function signUp(page: Page) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Pessoa E2E");
  await page.getByLabel("Nome de usuário").fill(`e2e_${id}`.slice(0, 20));
  await page.getByLabel("E-mail").fill(`e2e_${id}@example.com`);
  await page.getByLabel("Senha").fill("senha1234");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
}

const season = (page: Page, n: number) =>
  page.locator("details").filter({ has: page.locator("summary", { hasText: `Temporada ${n}` }) });

test("episode progress: mark episode, continue watching, season, whole series and completion", async ({
  page,
}) => {
  await signUp(page);
  await page.goto(SERIES_PATH);

  // LOG-05: first episode creates an active log and shows progress
  const s1 = season(page, 1);
  await s1.locator("summary").click();
  await s1.getByRole("checkbox", { name: /Marcar T1 Ep\. 1:/ }).check();
  await expect(page.getByText("Seu status: Assistindo")).toBeVisible();
  await expect(page.getByText(/^1 de \d+ episódios/)).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Seu progresso" })).toHaveAttribute(
    "aria-valuenow",
    /^[1-9]/,
  );

  // Continue watching row on the home page, with a progress bar
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Continuar assistindo" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: /Progresso de Breaking Bad/ })).toBeVisible();

  // LOG-06: mark a full season
  await page.goto(SERIES_PATH);
  await s1.locator("summary").click();
  await s1.getByRole("button", { name: "Marcar temporada como assistida" }).click();
  await expect(s1.getByRole("button", { name: "Desmarcar temporada" })).toBeVisible();
  await expect(s1.locator("summary")).toContainText("7/7");

  // Unmark one episode, then refresh: state persists (server is the source of truth)
  await s1.getByRole("checkbox", { name: /Marcar T1 Ep\. 2:/ }).uncheck();
  // The checkbox updates optimistically; let the server action finish before reloading, or the
  // reload would abort it and (correctly) leave the episode watched.
  await page.waitForLoadState("networkidle");
  await page.reload();
  await s1.locator("summary").click();
  await expect(s1.getByRole("checkbox", { name: /Marcar T1 Ep\. 2:/ })).not.toBeChecked();
  await expect(s1.getByRole("checkbox", { name: /Marcar T1 Ep\. 1:/ })).toBeChecked();

  // LOG-14: season rating
  await s1.getByRole("button", { name: "Avaliar temporada" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[data-star="4"]').click();
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(s1.getByRole("img", { name: "4,0 de 5 estrelas" })).toBeVisible();

  // LOG-08: whole series → asked to complete; "Agora não" keeps WATCHING
  await page.getByRole("button", { name: "Marcar série como assistida" }).click();
  const prompt = page.getByRole("dialog", { name: "Marcar série como concluída?" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Agora não" }).click();
  await expect(page.getByText("Seu status: Assistindo")).toBeVisible();

  // Unmark and mark again, this time confirming
  await page.getByRole("button", { name: "Desmarcar todos os episódios" }).click();
  await expect(page.getByRole("progressbar", { name: "Seu progresso" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.getByRole("button", { name: "Marcar série como assistida" }).click();
  await page
    .getByRole("dialog", { name: "Marcar série como concluída?" })
    .getByRole("button", { name: "Sim" })
    .click();
  await expect(page.getByText("Seu status: Concluída")).toBeVisible();

  // The completed log shows up in the diary
  await page.goto("/diario");
  await expect(page.getByRole("listitem").filter({ hasText: "Breaking Bad" })).toContainText(
    "Concluída",
  );
});

test("logged-out visitors see episodes read-only", async ({ page }) => {
  await page.goto(SERIES_PATH);
  const s1 = season(page, 1);
  await s1.locator("summary").click();
  await expect(s1.getByRole("listitem").first()).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});
