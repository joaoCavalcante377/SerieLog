import { expect, test } from "@playwright/test";

/** The end-to-end path from the project checklist, in one go. */
test("journey: sign up → search → log with rating → mark episodes → create list → view profile", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `jn_${id}`.slice(0, 20);

  // Sign up
  await page.goto("/cadastro");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome", { exact: true }).fill("Pessoa Jornada");
  await page.getByLabel("Nome de usuário").fill(username);
  await page.getByLabel("E-mail").fill(`jn_${id}@example.com`);
  await page.getByLabel("Senha").fill("senha1234");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");

  // Search from the header and open the first match
  await page.getByRole("combobox", { name: "Buscar séries" }).fill("Breaking Bad");
  await page
    .getByRole("option", { name: /Breaking Bad/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/serie\/1396-breaking-bad$/);

  // Log it with a rating and a review
  await page.getByRole("button", { name: "Registrar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[data-star="5"]').click();
  await dialog.getByRole("textbox", { name: "Crítica" }).fill("Perfeita.");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Seu status: Concluída")).toBeVisible();
  await expect(page.getByText(/^\d+ (avaliação|avaliações)$/)).toBeVisible();

  // Mark episodes (a whole season)
  const season = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Temporada 1" }) });
  await season.locator("summary").click();
  await season.getByRole("button", { name: "Marcar temporada como assistida" }).click();
  await expect(season.locator("summary")).toContainText("7/7");

  // Create a list and add this series from the series page menu
  await page.goto("/listas/nova");
  await page.getByLabel("Título").fill("Minha lista");
  await page.getByRole("button", { name: "Criar lista" }).click();
  await expect(page).toHaveURL(/editar$/);
  await page.goto("/serie/1396-breaking-bad");
  await page.getByRole("button", { name: "Adicionar à lista" }).click();
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: /Minha lista/ })
    .check();
  await expect(page.getByText("Adicionada a “Minha lista”")).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // Profile reflects everything
  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Pessoa Jornada" })).toBeVisible();
  await expect(
    page.locator("dl > div").filter({ hasText: "Séries assistidas" }).locator("dd"),
  ).toHaveText("1");
  await expect(page.getByRole("link", { name: "Breaking Bad" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Minha lista/ })).toBeVisible();
  await expect(page.getByText("Perfeita.")).toBeVisible();
});
