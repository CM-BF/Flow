import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const tooling = process.env.FLOW_WEB_TOOLING_DIR;
if (!tooling) throw new Error("Set FLOW_WEB_TOOLING_DIR to the W01 apps/web directory.");
const { config } = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent({ ...config, include: ["apps/web/src/components/workspace/**/*.tsx", "apps/web/src/components/workspace/**/*.ts", "docs/evidence/w01/workspace-panels/preview.tsx"] }, ts.sys, root);
const host = ts.createCompilerHost(parsed.options);
const aliases = {
  "../../ui/button": "src/components/ui/button.tsx",
  "../../ui/collapsible": "src/components/ui/collapsible.tsx",
  "../../../lib/utils": "src/lib/utils.ts",
};
host.resolveModuleNames = (names, containingFile) => names.map((name) => aliases[name]
  ? { resolvedFileName: path.join(tooling, aliases[name]), extension: ts.Extension.Tsx }
  : ts.resolveModuleName(name, containingFile, parsed.options, host).resolvedModule
    ?? ts.resolveModuleName(name, path.join(tooling, "src/index.ts"), parsed.options, host).resolvedModule);
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true }, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: (name) => name, getCurrentDirectory: () => root, getNewLine: () => "\n",
}));
console.log(`Workspace component typecheck: ${diagnostics.length} diagnostics`);
process.exitCode = diagnostics.length ? 1 : 0;
