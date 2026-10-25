export const SITE_NAME = "SerieLog";
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
export const DEFAULT_LOCALE = "pt-BR";

/** Words that cannot be used as usernames because they collide with routes. */
export const RESERVED_USERNAMES = [
  "series",
  "serie",
  "pesquisa",
  "entrar",
  "cadastro",
  "diario",
  "watchlist",
  "listas",
  "lista",
  "configuracoes",
  "sobre",
  "api",
  "admin",
  "_next",
] as const;
