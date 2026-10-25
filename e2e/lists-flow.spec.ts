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

async function addFromSearch(page: Page, name: string, expectedCount: number) {
  await page.getByLabel("Buscar série para adicionar").fill(name);
  // Wait for this exact result: earlier results stay on screen until the new search returns.
  await page.getByRole("button", { name: `Adicionar: ${name}`, exact: true }).click();
  const count = `${expectedCount} ${expectedCount === 1 ? "série" : "séries"}`;
  await expect(page.getByRole("heading", { name: count })).toBeVisible({ timeout: 45_000 });
}

const handleLabels = (page: Page) =>
  page
    .getByRole("button", { name: /^Reordenar / })
    .evaluateAll((els) =>
      els.map((e) =>
        (e.getAttribute("aria-label") ?? "").replace(/^Reordenar /, "").replace(/\. Use.*$/, ""),
      ),
    );

test("lists: create, add via search, reorder with the keyboard, rank, privacy and delete", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const username = await signUp(page);

  // LST-01: create
  await page.goto("/listas/nova");
  await page.getByLabel("Título").fill("Melhores dramas");
  await page.getByRole("button", { name: "Criar lista" }).click();
  await expect(page).toHaveURL(new RegExp(`/${username}/lista/melhores-dramas/editar$`));

  // Add three series through the editor search
  await addFromSearch(page, "Breaking Bad", 1);
  await addFromSearch(page, "Better Call Saul", 2);
  await addFromSearch(page, "Chernobyl", 3);

  // LST-03: the same series cannot be added again (button is disabled with the reason)
  await page.getByLabel("Buscar série para adicionar").fill("Chernobyl");
  await expect(
    page.getByRole("button", { name: "Esta série já está na lista: Chernobyl" }),
  ).toBeDisabled();
  await page.getByLabel("Buscar série para adicionar").fill("");

  // LST-04: keyboard reorder — move item 3 to position 1
  const before = await handleLabels(page);
  expect(before).toHaveLength(3);
  const third = page.getByRole("button", { name: /^Reordenar / }).nth(2);
  await third.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");
  await expect(page.getByText("Ordem salva")).toBeVisible();

  const expected = [before[2], before[0], before[1]];
  await expect.poll(() => handleLabels(page)).toEqual(expected);
  await page.reload();
  expect(await handleLabels(page)).toEqual(expected);

  // Ranked lists show numbers on the public page
  await page.getByLabel("Lista ranqueada (mostra a numeração)").check();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Lista atualizada")).toBeVisible();
  await page.getByRole("link", { name: "Ver lista" }).click();
  await expect(page).toHaveURL(new RegExp(`/${username}/lista/melhores-dramas$`));
  await expect(page.getByRole("heading", { level: 1, name: "Melhores dramas" })).toBeVisible();
  const posters = page.getByRole("listitem").filter({ has: page.getByRole("link") });
  await expect(posters.first()).toContainText(/1/);
  const names = await page.locator("ol > li a p.truncate").allTextContents();
  expect(names).toHaveLength(3);
  expect(names[0]).toContain(expected[0]);

  // Share image
  const og = await page.request.get(`/${username}/lista/melhores-dramas/opengraph-image`);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");

  // LST-02: same title again → slug -2
  await page.goto("/listas/nova");
  await page.getByLabel("Título").fill("Melhores dramas");
  await page.getByRole("button", { name: "Criar lista" }).click();
  await expect(page).toHaveURL(new RegExp(`/${username}/lista/melhores-dramas-2/editar$`));

  // LST-05: private → 404 for visitors, still visible to me
  await page.goto(`/${username}/lista/melhores-dramas/editar`);
  await page.getByLabel("Lista pública").uncheck();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Lista atualizada")).toBeVisible();

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  const res = await visitorPage.goto(`/${username}/lista/melhores-dramas`);
  expect(res?.status()).toBe(404);
  await expect(visitorPage.getByText("Página não encontrada")).toBeVisible();
  await visitor.close();
  await page.goto(`/${username}/lista/melhores-dramas`);
  await expect(page.getByRole("heading", { level: 1, name: /Melhores dramas/ })).toBeVisible();

  // LST-08: delete with confirmation
  await page.goto(`/${username}/lista/melhores-dramas-2/editar`);
  await page.getByRole("button", { name: "Excluir lista" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(new RegExp(`/${username}/listas$`));
  await expect(page.getByRole("link", { name: /Melhores dramas/ })).toHaveCount(1);
});

test("series page: 'Adicionar à lista' menu adds and removes the series", async ({ page }) => {
  test.setTimeout(120_000);
  const username = await signUp(page);
  await page.goto("/listas/nova");
  await page.getByLabel("Título").fill("Favoritas");
  await page.getByRole("button", { name: "Criar lista" }).click();
  await expect(page).toHaveURL(/editar$/);

  await page.goto("/serie/1396-breaking-bad");
  await page.getByRole("button", { name: "Adicionar à lista" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /Favoritas/ }).check();
  await expect(page.getByText("Adicionada a “Favoritas”")).toBeVisible();

  await page.goto(`/${username}/lista/favoritas`);
  await expect(page.getByText("Breaking Bad").first()).toBeVisible();

  await page.goto("/serie/1396-breaking-bad");
  await page.getByRole("button", { name: "Adicionar à lista" }).click();
  const again = page.getByRole("dialog").getByRole("checkbox", { name: /Favoritas/ });
  await expect(again).toBeChecked();
  await again.uncheck();
  await expect(page.getByText("Removida de “Favoritas”")).toBeVisible();
});

test("LST-07 another user cannot open the editor of my list", async ({ page, browser }) => {
  const username = await signUp(page);
  await page.goto("/listas/nova");
  await page.getByLabel("Título").fill("Só minha");
  await page.getByRole("button", { name: "Criar lista" }).click();
  await expect(page).toHaveURL(/editar$/);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signUp(otherPage);
  const res = await otherPage.goto(`/${username}/lista/so-minha/editar`);
  expect(res?.status()).toBe(404);
  await other.close();
});
