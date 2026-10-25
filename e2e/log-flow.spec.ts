import { expect, test, type Page } from "@playwright/test";

const SERIES_PATH = "/serie/1396-breaking-bad";

function newUser() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    name: "Pessoa E2E",
    username: `e2e_${id}`.slice(0, 20),
    email: `e2e_${id}@example.com`,
    password: "senha1234",
  };
}

async function fillSignUp(page: Page, user: ReturnType<typeof newUser>) {
  await page.getByLabel("Nome", { exact: true }).fill(user.name);
  await page.getByLabel("Nome de usuário").fill(user.username);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
}

test("SER-05 logged-out watchlist action completes after sign-up and returns to the series", async ({
  page,
}) => {
  const user = newUser();
  await page.goto(SERIES_PATH);
  await expect(page.getByRole("heading", { level: 1, name: /Breaking Bad/ })).toBeVisible();

  await page.getByRole("button", { name: "Adicionar à watchlist" }).click();
  await expect(page).toHaveURL(/\/entrar\?callbackUrl=/);

  await page.getByRole("link", { name: "Cadastrar" }).last().click();
  await expect(page).toHaveURL(/\/cadastro\?callbackUrl=/);
  await fillSignUp(page, user);

  await expect(page).toHaveURL(new RegExp(`${SERIES_PATH}$`));
  await expect(page.getByRole("button", { name: "Na watchlist" })).toBeVisible();

  await page.goto("/watchlist");
  await expect(page.getByRole("link", { name: /Breaking Bad/ }).first()).toBeVisible();
});

test("log a series with stars and review, see it in the diary, edit and delete it", async ({
  page,
}) => {
  const user = newUser();
  await page.goto("/cadastro");
  await fillSignUp(page, user);
  await expect(page).toHaveURL("/");

  await page.goto(SERIES_PATH);
  await page.getByRole("button", { name: "Registrar" }).click();
  const dialog = page.getByRole("dialog");

  // LOG-02: 4th star twice → 3,5
  await dialog.locator('[data-star="4"]').click();
  await dialog.locator('[data-star="4"]').click();
  await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuetext", "3,5 de 5 estrelas");
  // Keyboard: ArrowRight → 4,0
  await dialog.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuetext", "4,0 de 5 estrelas");

  await dialog.getByRole("textbox", { name: "Crítica" }).fill("Obra-prima.\nSegunda linha.");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // LOG-01: community average now shows the rating
  await expect(page.getByText(/^\d+ (avaliação|avaliações)$/)).toBeVisible();

  await page.goto("/diario");
  const row = page.getByRole("listitem").filter({ hasText: "Breaking Bad" });
  await expect(row).toBeVisible();
  await expect(row.getByRole("img", { name: "4,0 de 5 estrelas" })).toBeVisible();

  // Edit
  await row.getByRole("button", { name: /^Editar/ }).click();
  const edit = page.getByRole("dialog");
  await edit.getByRole("slider").focus();
  await page.keyboard.press("End");
  await edit.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(row.getByRole("img", { name: "5,0 de 5 estrelas" })).toBeVisible();

  // Delete: cancelling changes nothing, confirming removes it (DIA-04)
  await row.getByRole("button", { name: /^Excluir/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /^Excluir/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("Seu diário está vazio.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Buscar séries" })).toBeVisible();
});

test("AUTH-05 protected route redirects and returns after login", async ({ page }) => {
  const user = newUser();
  await page.goto("/cadastro");
  await fillSignUp(page, user);
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

  await page.goto("/diario");
  await expect(page).toHaveURL(/\/entrar\?callbackUrl=\/diario$/);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha").fill("errada123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible();

  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/diario");
});

test("WAT-04 a private watchlist shows a privacy message to other people", async ({
  page,
  browser,
}) => {
  const user = newUser();
  await page.goto("/cadastro");
  await fillSignUp(page, user);
  await expect(page).toHaveURL("/");

  await page.goto("/configuracoes");
  await page.getByLabel("Watchlist pública").uncheck();
  await expect(page.getByText("Privacidade atualizada")).toBeVisible();

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/${user.username}/watchlist`);
  await expect(visitorPage.getByText("Esta watchlist é privada")).toBeVisible();
  await visitor.close();

  await page.goto(`/${user.username}/watchlist`);
  await expect(page.getByText("Esta watchlist é privada")).toBeHidden();
});
