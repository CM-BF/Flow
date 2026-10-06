export interface Theme {
  id: string;
  label: string;
  scheme: "light" | "dark";
  tokens: Record<string, string>;
}
export const themes: Theme[] = [
  {
    id: "light",
    label: "Light",
    scheme: "light",
    tokens: {
      canvas: "#f3f6fc",
      surface: "#ffffff",
      raised: "#f8faff",
      text: "#20293a",
      muted: "#626f84",
      border: "#dce3ef",
      accent: "#385bc7",
      "accent-soft": "#e9efff",
      "on-accent": "#ffffff",
      success: "#187044",
      "success-soft": "#e7f5ed",
      warning: "#885500",
      "warning-soft": "#fff3d5",
      danger: "#b33345",
      "danger-soft": "#ffedf0",
    },
  },
  {
    id: "dark",
    label: "Dark",
    scheme: "dark",
    tokens: {
      canvas: "#151b2a",
      surface: "#1d2638",
      raised: "#222e44",
      text: "#edf2fd",
      muted: "#b0bdd3",
      border: "#36425b",
      accent: "#aac0ff",
      "accent-soft": "#2a3c68",
      "on-accent": "#17213d",
      success: "#84ddae",
      "success-soft": "#223e37",
      warning: "#f4cb80",
      "warning-soft": "#40372a",
      danger: "#ffabb7",
      "danger-soft": "#462b39",
    },
  },
];
export function applyTheme(id: string) {
  const theme = themes.find((item) => item.id === id) ?? themes[0]!;
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.style.colorScheme = theme.scheme;
  for (const [name, value] of Object.entries(theme.tokens))
    document.documentElement.style.setProperty(`--${name}`, value);
  try {
    localStorage.setItem("flow.theme.v1", theme.id);
  } catch {
    /* Theme still works when storage is blocked. */
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
