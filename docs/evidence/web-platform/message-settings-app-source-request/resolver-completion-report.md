# MSG03 固定 c130 依赖供给补核（只读）

状态：**STATIC_SUPPLY_CHECKED；NOT_RUNTIME_READY；NOT_PROVISIONED**。原 MATURE02 TODO11 / WPF-MESSAGESETTINGS03，唯一候选 owner workspace_panels_owner。观察 2026-10-07T12:04:02.809869+00:00。本段没有新 task、claim、worktree、Git/config 改动、项目写入、包复制、Node/import、测试/build、安装、网络、PG、Chrome 或容量/进程采样。只读 Git/Python 文件解析；全部本段输出位于本目录，manifest 记实际总量，低于 2 MiB。

固定源 `c13042ba7e74733d8c68cc05bd1b2d7cb5bbaa50`。复用先前 `/private/tmp/msgquick-real-app-supply-20261007/` 的 369 files / 2,650,881 B 源候选与 43 个包候选，不重新设计 TODO11；18 literal 不变。本报告不替代 Original 的具体供给/一次 operator 授权，也不替代未来 fresh take。

## 已固定的部分

- 原 369 个 Git blob、bytes、SHA256 全部吻合；静态复扫 1,780 个模块/HTML/CSS 边，152 次 `@flow` 引用覆盖到 5 个实际 export 入口，无新增未覆盖相对/workspace literal import、literal URL 文件或非 literal import/require 候选。它是词法提取加下述 SQL 人工限定对照，不是 TypeScript AST/实际 resolver 执行证明。
- 31 个 SQL 文件已在 369 内。`goal-tool-runs/index.ts:15–17` 的 012/013、`conversations/index.ts:16–18` 的 007/035 四个 template URL 目标逐一在固定字符串数组及供给列表中；没有用通配目录补供给。
- 43/43 既有候选的 requested link→realRoot、manifest bytes/hash/name/version 与前次一致，锁文件中相应 package key 存在。该检查不是完整 lock peer variant 或 semver 求解。tar 明确选 Flow 主树既有 tar7.5.22；m2-integration 同版本仅列未选 alternative。其余 realRoot 位于既有 web-attachment-production `.pnpm`；未碰已退役 workspace-cache。
- 固定 **351 个唯一入口/必要类型/本机工具文件**，每个记录实际 path/realpath/dev/inode/uid/mode/bytes/mtime/hash，读取前后 identity 稳定。包括源码使用子入口、React JSX runtime、ReactDOM client、markdown dot CSS、Vite client ambient、Vitest config/CLI、TypeScript bin/tsc/_tsc 与 ES2023/DOM lib seed、tsx root loader/ESM/CJS/API、esbuild main/CLI。conditional exports 的相关分支分别列出，不声称 Node、Vite 与 TypeScript 选择同一分支。
- 必要声明根及 **245 条一级相对声明边**实际存在；`.ts`→`.d.ts` 扩展替换已对 pg-boss 核到，React/Vitest 注释中的示例 import 已排除。另 **308 条 bare 声明引用**仅列明未递归，不假装完整类型闭包。后加隐式根入口也已 pin，未再声称它们的所有声明递归闭合。
- 从这 43 个包的 dependencies/optional/peer 作有界一级解析：**315 条声明边、203 个实际 package manifest identity**；必需一级 manifest 缺失 **0**。46 条未解析均声明 optional：大部分异平台 esbuild，也包括未启用 React compiler、pg-native、CSS 预处理器、Vitest browser/jsdom 等。本次不安装，不能推断使用这些能力也已满足。
- 显式 Darwin/arm64 工具链核到并 pin 实际 payload：esbuild0.28.2 native、Vite8.3.2→Rolldown1.2.12 native、LightningCSS1.33.0 native、Tailwind4.3.3→Oxide native；Playwright1.63.0→playwright-core1.63.0 的 types/coreBundle pin。没有启动它们，也没有把 Chrome/browser bundle 的可运行性并入本段。
- Node 路径 `/opt/homebrew/opt/node@24/bin/node` realpath `/opt/homebrew/Cellar/node@24/24.20.0/bin/node`，50320 B，SHA256 `ee2a4493dc9e1bd0cf10f6a1aa773d0452054e2cb179b461f4d60cef66bd01ba`。这里只是文件/Cellar 路径身份；没有执行 `--version`，没有闭合全部 dyld 依赖。

## 不能压平的 resolver 事实

Web / @tailwindcss/vite / @vitejs/plugin-react 对应 **Vite8.3.2**；**Vitest4.0.18 自身声明并解析到 Vite7.3.6**。须保留既有 pnpm 内部链接拓扑，不能统一改指向 Web Vite。tsx4.23.15 的 esbuild0.28.2 也沿其自己的 pnpm 依赖解析。React/ReactDOM 相关已读一级依赖均为19.3.0，实际 singleton/bundler行为仍待合法局部检查。

未来仅为候选 43 个第三方包设置获授权的精确只读链接/alias，不 wholesale link donor 的 root node_modules；**全部 `@flow` 必须指向未来新 WT 同 c130 source**。5 个实际入口见 `workspace-mapping.json`：client/contracts 根、interaction activity/stream、plugin-runtime package-store；不能从 donor @flow 偷接代码。新私有 adapter 文件当前不存在，待合法 take 后由 owner 创建。

## 明确 UNKNOWN / 后续最小检查

1. 这不是第三方全 payload/CAS 完整性或全递归 dependency/type 证明。未沿 203 个 manifest 再无限展开，未验证所有动态 require、package internal chunk、native ABI/dyld、TS typesVersions 和条件出口实际选择。已 pin 的入口存在与上述未知分开；保留原 pnpm 图、后续实际受影响检查失败时只补具体缺项，不先复制整包或安装。
2. `apps/web/tsconfig.json` include `src/test/*.ts` 比 369 这份受影响闭包更宽。本供给只证明列明图，**不能用稀疏树全 Web typecheck 声称所有 Web 都检查了**。合法物化/实现后先以原 TS5.9.3 工具对实际受影响明确 files/同 compilerOptions 做 noEmit；要跑完整 Web noEmit 应先明确其 include 的完整源码供给边界。
3. direct 复用 Vitest4.0.18 入口，显式选择新 settings/完整 draft/send-queue/恢复受影响 case，不能直接跑 root 默认全库 include，也不能重跑原 Recovery 全绿来代 MSG03。Browser 必须在这 3 个已候选 harness 路径内接新 MSG03 独立记录/fixture入口；旧 Recovery gate/budget/证据路径不可消费或写回。当前没有任何可用新 browser gate/资源准入，未生成凭据。
4. Vite/App/browser实际 package resolution、React singleton 和原 UI 行为尚未运行；未来必要 Vite+独立 fixture/browser检查纳入已批准 owner 有界段，不以本报告给出 runtime PASS。第三方 donor 以后被移动/回收、任何 source/entry identity 漂移须 fresh 校验，不假设持续保留。
5. `tw-shimmer`虽在 Web package.json声明，但固定369图没有使用边，未因此增加第44候选；若未来实现实际引入才核具体供给。没有扩大 unrelated serverfixture、runner 或共享合同范围。

## 43 个既有候选版本

| Package | 观察版本 |
| --- | --- |
| @assistant-ui/react | 0.15.23 |
| @assistant-ui/react-markdown | 0.14.18 |
| @fastify/cors | 11.3.0 |
| @playwright/test | 1.63.0 |
| @radix-ui/react-avatar | 1.2.7 |
| @radix-ui/react-collapsible | 1.1.21 |
| @radix-ui/react-dialog | 1.2.0 |
| @radix-ui/react-slot | 1.4.0 |
| @radix-ui/react-tooltip | 1.3.0 |
| @tailwindcss/vite | 4.3.3 |
| @types/node | 24.19.1 |
| @types/npm-package-arg | 6.1.4 |
| @types/pacote | 11.1.8 |
| @types/pg | 8.23.1 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| @types/ssri | 7.1.5 |
| @vitejs/plugin-react | 6.1.2 |
| ansi-to-react | 6.2.6 |
| class-variance-authority | 0.7.1 |
| clsx | 2.1.1 |
| esbuild | 0.28.2 |
| fastify | 5.12.5 |
| lucide-react | 1.52.0 |
| npm-package-arg | 13.0.2 |
| pacote | 21.5.1 |
| pg | 8.23.1 |
| pg-boss | 12.37.0 |
| radix-ui | 1.7.0 |
| react | 19.3.0 |
| react-dom | 19.3.0 |
| remark-gfm | 4.0.1 |
| ssri | 13.0.1 |
| tailwind-merge | 3.7.0 |
| tailwindcss | 4.3.3 |
| tar | 7.5.22 |
| tsx | 4.23.15 |
| tw-animate-css | 1.4.0 |
| typescript | 5.9.3 |
| vite | 8.3.2 |
| vitest | 4.0.18 |
| zod | 4.6.5 |
| zustand | 5.0.15 |

## 方法与质量安全点

按已安装 find-skills 方法先匹配本地技能，无联网/安装：`/Users/citrine/.agents/skills/find-skills/SKILL.md`、`/Users/citrine/.agents/skills/clean-code/SKILL.md`。固定 c130 AGENTS 已读。clean-code 实际应用为分开 source closure、export-entry、type-one-hop、native-chain 责任；错误显式保留，拒绝把可选缺包当强制安装，拒绝把词法存在当实际执行结果；无新运行器/框架或产品改动。本段末 source 与 runtime 权威边界、命名/重复/异常处理复核完成；未运行被检产品，也没有因此制造测试。

机器原件：`source-recheck.json` SHA256 `b4a06a0b0fb43db409cec3f061333b4ad2789a0546f2ebce2757fba7aad08e6a`；`resolver-audit.json` SHA256 `42b3e6d55d7deaf430f0ec56994ccf3d8fd192589efed273c277559ac821223d`。完整 output pins 和本地技能 hash 见 `manifest.json`。重建方法是 `inspect.py` 后 `add-root-entries.py`；仅文件/Git只读，不是产品检查入口。
