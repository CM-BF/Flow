export interface Theme {
  id: string;
  label: string;
  scheme: "light" | "dark";
  tokens: Record<string, string>;
}
/** Built-in choices share semantic colors; opaque variants disable shell transparency. */
export const themes: Theme[] = [
  { id: "light", label: "Light", scheme: "light", tokens: {} },
  { id: "dark", label: "Dark", scheme: "dark", tokens: {} },
  {
    id: "light-opaque", label: "Light opaque", scheme: "light",
    tokens: { "flow-material-opacity": "100%", "flow-glass-filter": "none" },
  },
  {
    id: "dark-opaque", label: "Dark opaque", scheme: "dark",
    tokens: { "flow-material-opacity": "100%", "flow-glass-filter": "none" },
  },
];
export const isBuiltinTheme = (id: string) => themes.some((theme) => theme.id === id);
let overrides: string[] = [];
export function applyTheme(value: string | Theme) {
  const theme = typeof value === "string" ? themes.find((item) => item.id === value) ?? themes[0]! : value;
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
