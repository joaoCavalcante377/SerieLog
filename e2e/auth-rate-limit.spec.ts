import { expect, test } from "@playwright/test";

test("AUTH-07 five wrong passwords block further logins for that email, with a clear message", async ({
  page,
}) => {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `rl_${id}@example.com`;

  await page.goto("/cadastro");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome", { exact: true }).fill("Pessoa RL");
  await page.getByLabel("Nome de usuário").fill(`rl_${id}`.slice(0, 20));
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha1234");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

  await page.goto("/entrar");
  await page.waitForLoadState("networkidle");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("errada123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible();
  }

  // The 6th attempt is refused even with the right password.
  await page.getByLabel("Senha").fill("senha1234");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByText(/Muitas tentativas de login\. Tente novamente em \d+ minutos?\./),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});
