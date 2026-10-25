import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `e2e_${id}`.slice(0, 20);
  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Pessoa E2E");
  await page.getByLabel("Nome de usuário").fill(username);
  await page.getByLabel("E-mail").fill(`e2e_${id}@example.com`);
  await page.getByLabel("Senha").fill("senha1234");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
  return username;
}

const counter = (page: Page, label: string) =>
  page
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("dd");

test("PRO-01/02/07 public profile renders for anyone, counters follow logs, unknown user is a 404", async ({
  page,
  browser,
}) => {
  const username = await signUp(page);

  await page.goto("/serie/1396-breaking-bad");
  await page.getByRole("button", { name: "Registrar" }).click();
  await page.getByRole("dialog").locator('[data-star="5"]').click();
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto(`/${username}`);
  await expect(page.getByRole("heading", { level: 1, name: "Pessoa E2E" })).toBeVisible();
  await expect(page.getByText(`@${username}`, { exact: true })).toBeVisible();
  await expect(counter(page, "Séries assistidas")).toHaveText("1");
  await expect(counter(page, "Este ano")).toHaveText("1");
  await expect(page.getByRole("heading", { name: /Distribuição das notas/ })).toContainText("5,0");
  await expect(page.getByRole("link", { name: "Breaking Bad" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar favoritas" })).toBeVisible(); // owner only

  // Anyone (logged out) can see it, without owner controls
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  const res = await visitorPage.goto(`/${username}`);
  expect(res?.status()).toBe(200);
  await expect(visitorPage.getByRole("heading", { level: 1, name: "Pessoa E2E" })).toBeVisible();
  await expect(visitorPage.getByRole("button", { name: "Editar favoritas" })).toHaveCount(0);

  // PRO-02
  const missing = await visitorPage.goto("/naoexiste");
  expect(missing?.status()).toBe(404);
  await expect(visitorPage.getByText("Página não encontrada")).toBeVisible();
  await visitor.close();
});

test("PRO-03 pick four favorites in order; a fifth is blocked", async ({ page }) => {
  test.setTimeout(180_000);
  const username = await signUp(page);
  await page.goto(`/${username}`);
  await page.getByRole("button", { name: "Editar favoritas" }).click();
  const dialog = page.getByRole("dialog");

  const names = ["Breaking Bad", "Better Call Saul", "Chernobyl", "Dark"];
  for (const [i, name] of names.entries()) {
    await dialog.getByLabel("Buscar séries").fill(name);
    await dialog.getByRole("button", { name: `Adicionar: ${name}`, exact: true }).click();
    await expect(dialog.getByRole("button", { name: /^Reordenar / })).toHaveCount(i + 1, {
      timeout: 45_000,
    });
  }

  // The picker disappears at four and the limit message is shown
  await expect(dialog.getByText("Máximo de 4 favoritas")).toBeVisible();
  await expect(dialog.getByLabel("Buscar séries")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Fechar" }).click();
  const shown = await page.locator("ol.grid li a p").allTextContents();
  expect(shown).toEqual(names);

  // Remove one and the slot opens again
  await page.getByRole("button", { name: "Editar favoritas" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Remover Chernobyl/ })
    .click();
  await expect(page.getByRole("dialog").getByLabel("Buscar séries")).toBeVisible();
});

test("PRO-04 bio edits show on the profile; over 160 characters is refused", async ({ page }) => {
  const username = await signUp(page);
  await page.goto("/configuracoes");
  await page.waitForLoadState("networkidle"); // forms must be hydrated before submitting
  await page.getByLabel("Bio").fill("Maratonista de séries.\nSegunda linha.");
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await expect(page.getByText("Perfil atualizado")).toBeVisible();

  await page.goto(`/${username}`);
  await expect(page.getByText("Maratonista de séries.")).toBeVisible();

  // PRO-04: over 160 characters is refused
  await page.goto("/configuracoes");
  await page.waitForLoadState("networkidle"); // forms must be hydrated before submitting
  await page.getByLabel("Bio").fill("x".repeat(161));
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await expect(page.getByText("A bio deve ter no máximo 160 caracteres")).toBeVisible();
});
