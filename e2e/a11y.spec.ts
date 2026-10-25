import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Automated WCAG 2.1 A/AA checks (axe). Manual keyboard/screen-reader checks are listed in docs/ARCHITECTURE.md. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join("\n   ")}`,
  );
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
}

async function signUp(page: Page) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `ax_${id}`.slice(0, 20);
  await page.goto("/cadastro");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome", { exact: true }).fill("Pessoa A11y");
  await page.getByLabel("Nome de usuário").fill(username);
  await page.getByLabel("E-mail").fill(`ax_${id}@example.com`);
  await page.getByLabel("Senha").fill("senha1234");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
  return username;
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`a11y (${theme})`, () => {
    test.beforeEach(async ({ page }) => setTheme(page, theme));

    test("public pages", async ({ page }) => {
      for (const path of [
        "/",
        "/series",
        "/pesquisa?q=breaking",
        "/serie/1396-breaking-bad",
        "/entrar",
        "/cadastro",
        "/sobre",
        "/listas",
        "/naoexiste",
      ]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await scan(page, `${theme} ${path}`);
      }
    });

    test("signed-in pages and dialogs", async ({ page }) => {
      test.setTimeout(120_000);
      const username = await signUp(page);

      await page.goto("/serie/1396-breaking-bad");
      await page.waitForLoadState("networkidle");
      await page.locator("details summary").first().click(); // expanded season with checkboxes
      await scan(page, `${theme} series page (signed in)`);

      await page.getByRole("button", { name: "Registrar" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await scan(page, `${theme} log dialog`);
      await page.getByRole("dialog").locator('[data-star="4"]').click();
      await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await page.goto("/listas/nova");
      await page.getByLabel("Título").fill("Lista A11y");
      await page.getByRole("button", { name: "Criar lista" }).click();
      await expect(page).toHaveURL(/editar$/);
      await page.getByLabel("Buscar série para adicionar").fill("Breaking Bad");
      await page.getByRole("button", { name: "Adicionar: Breaking Bad", exact: true }).click();
      await expect(page.getByRole("heading", { name: "1 série" })).toBeVisible({ timeout: 45_000 });
      await scan(page, `${theme} list editor`);

      for (const path of [
        "/diario",
        "/watchlist",
        "/configuracoes",
        `/${username}`,
        `/${username}/diario`,
        `/${username}/listas`,
        `/${username}/lista/lista-a11y`,
      ]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await scan(page, `${theme} ${path}`);
      }
    });
  });
}
