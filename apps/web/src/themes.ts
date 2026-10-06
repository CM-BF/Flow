export interface Theme {
  id: string;
  label: string;
  scheme: "light" | "dark";
  tokens: Record<string, string>;
}
/** Defaults use the official assistant-ui/shadcn token palette; extra themes can override semantic tokens. */
export const themes: Theme[] = [
  { id: "light", label: "Light", scheme: "light", tokens: {} },
  { id: "dark", label: "Dark", scheme: "dark", tokens: {} },
];
let overrides: string[] = [];
export function applyTheme(id: string) {
  const theme = themes.find((item) => item.id === id) ?? themes[0]!;
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.classList.toggle("dark", theme.scheme === "dark");
  document.documentElement.style.colorScheme = theme.scheme;
  for (const name of overrides)
    document.documentElement.style.removeProperty(`--${name}`);
  overrides = Object.keys(theme.tokens);
  for (const [name, value] of Object.entries(theme.tokens))
    document.documentElement.style.setProperty(`--${name}`, value);
  try {
    localStorage.setItem("flow.theme.v1", theme.id);
  } catch {
    /* Theme works without storage. */
  }
}
export function initialTheme() {
  try {
    const stored = localStorage.getItem("flow.theme.v1");
    if (themes.some((theme) => theme.id === stored)) return stored!;
  } catch {
    /* Use system preference. */
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
