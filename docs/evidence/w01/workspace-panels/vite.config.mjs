import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const directory = path.dirname(fileURLToPath(import.meta.url));
const tooling = process.env.FLOW_WEB_TOOLING_DIR;
if (!tooling) throw new Error("Set FLOW_WEB_TOOLING_DIR to the W01 apps/web directory with installed dependencies.");
const require = createRequire(path.join(tooling, "package.json"));
const react = (await import(require.resolve("@vitejs/plugin-react"))).default;
const tailwind = (await import(require.resolve("@tailwindcss/vite"))).default;
export default {
  root: directory,
  cacheDir: path.resolve(directory, "../../../../node_modules/.vite-workspace-panels"),
  plugins: [react(), tailwind()],
  resolve: { alias: [
    ...["react-dom/client", "react/jsx-dev-runtime", "react/jsx-runtime", "react-dom", "react", "lucide-react", "ansi-to-react"].map((name) => ({ find: name, replacement: require.resolve(name) })),
    { find: "../../ui/button", replacement: path.join(tooling, "src/components/ui/button.tsx") },
    { find: "../../ui/collapsible", replacement: path.join(tooling, "src/components/ui/collapsible.tsx") },
    { find: "../../../lib/utils", replacement: path.join(tooling, "src/lib/utils.ts") },
    { find: "tailwindcss", replacement: require.resolve("tailwindcss/index.css") },
  ] },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [path.resolve(directory, "../../../.."), path.resolve(tooling, "../..")] } },
};
