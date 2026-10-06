# QuickControls → OPS-CI01 consumer 接收核验（只读 / NOT_RUN）

结论：**不能把当前 OPS-CI01 候选直接接收为 c1 或 b1 的验证证据**。可以继续独立审查它明示的 contracts2 + handler1 小范围；QuickControls 需要一个后继的精确入口/来源/结果合同，不能只改期待计数或搬本机绝对路径。本文不阻止原 CI 小片接收，不授权远程启用，不重做源审。

## 固定输入与现状

- CI 固定 `abc7444ddb3a3724763567d1955e58b157ba51df`（`codex/ops-remote-validation`，开始观测 clean）；其 status L23/Review 指文档实现 `cdd96bc759826f4e061da9cbb61b4f0881f2cbd9`。本文所有源码引用均 git-show abc744，不追 moving 文件。
- QuickControls 四源 `fe6ece131c489c79cf531a184e4cf51209f9c4a0`；owner metadata `38bfce69c632d52e1e1d3ab02cff21fbcc21b826`。c1、b1 都只静态批准，真实检查仍 NOT_RUN；c1 原包仍绑定3fb，由管理在真实准入时安全重绑。
- abc744 的 Picker/direct/fixture/browser 四个 blob **全部不同于 fe6**；catalog、selection、root/web package与lock字节相同。精确四hash及对照在 audit.json。直接触发默认分支 job 不能自动覆盖未接收的 QuickControls 分支；须事先将已审四源受控接入选定 immutable run SHA，核其字节及直接依赖闭包。不要运行中拷任意文件或借本机 source tree。

## 当前文档实际做什么

`docs/ci/check-workflow.yml:62–79` 只执行 `packages/contracts/src/contracts.test.ts` 与 `apps/server/src/server.test.ts -t 'persists accepted commands across restart and rejects changed retries$'`；无 TypeScript/noEmit、QuickControls direct 或浏览器调用。L122–143 强制实际 exit0、success、2+0 或1+9计数、零失败和清理，缺失/零选/超时会失败——这是原两项的有用防误绿合同，**不是26或6组验收**。

README L12/20/24/43 已明确真实PG+Fastify.inject、不含UI/全库typecheck、没有artifact upload、仍停用文档候选；L30–37保留用户最终启用步骤。无须把这些诚实边界写成现有CI产品bug。

## 最小必需接缝（后继候选，不在本次实施）

| 消费方 | 真实入口与最小配置 | 结果接收与边界 |
| --- | --- | --- |
| c1 types | TypeScript5.9.3 `--noEmit -p <targeted config>`，strict + noUncheckedIndexedAccess；显式四源、catalog/selection及Vite CSS声明，own @flow源码。root tsconfig L11–12有strict，但全库pnpm typecheck不是当前局部合同。 | 记录确切source SHA、配置hash、compiler真实exit0；types失败/未执行不能进browser。 |
| c1 direct | Vitest4.0.18只选 `apps/web/test/message-settings.test.ts`，单worker/无并行；真实TSX Picker helpers（test L15），JSX automatic + Node-only `test.css=false`，真实React/Radix等JS解析。c1 vitest.config L64–70为已审方法。远程使用锁定workspace安装的真实包、@flow exports→src（两package L6）；本机 `/Users/...m2-integration` 和 `/private/tmp` alias不可直接带入Linux。 | 原file展开 **26 exact names**，以 c1 expected-tests.json 为规范；1 file、26 passed、0 failed/skip/todo、实际Vitest exit0+JSON。不能只统计普通it17，更不能继承Settings01 37。 |
| b1 browser | fe6 browser L29 `startMessageSettingsFixture({cacheDir,aliases})` → own Page → L68 `checkMessageSettingsPicker(page,fixture,evidence)`。这两个是export函数，没有Playwright `test()`；现`pnpm --filter @flow/web test:browser`/默认config会选择全体旧*.browser、启动旧4318/5175 fixture并写旧w01证据（config L3–28），不是本场景入口。须一个窄远程launcher调用这两个真实函数并finally关闭自有Vite/context/browser；不复制断言。 | 精确六组完成记录、pageErrors=[]、fixture/context/browser清理、真实launcher exit0；报告/source/config/browser版本绑定，保 Light/Dark390两PNG。只写6个check标签而未调用实际函数不可接收。先同四源c1真实通过；原本机b1只是接口/语义参考。 |

浏览器必须用真实CSS：fixture L9–11 themes/assistant-ui.css/styles.css，assistant-ui.css继续import tailwindcss/tw-animate-css；Picker→execution-profiles.css/dialog/button/utils；browser L32–35真实Vite React+Tailwind与显式TSX optimizeDeps.entries。不能把direct CSS=false传播到browser。锁定依赖Vite8.3.2/React19.3/Tailwind4.3.3/Playwright1.63；CI `--ignore-scripts` 安装的Linux可选二进制及受控browser provisioning尚未验证，缺失应明确失败，不偷偷改安装/下载/预算。当前文档没有浏览器安装或launch闭包。

本机c1含macOS sandbox-exec，b1含macOS native Chrome sibling/目录策略；不得直接复用其OS假设或把Linux容器/Chrome说成同一边界。远程后继需独立明确进程/网络/临时目录/清理与资源上限、浏览器版本，仍0模型。当前60s/15cleanup、64MiB/8MiB与c1 30s/5cleanup是本机待准入合同，不是已批准的远程12min额度细分。CI job success不能替代本机的外层真实exit+seal输入；若要让远程结果满足b1前置，须独立接收同四源、types26精确结果及真实exit/完整报告的一致合同，不能作者自填PASS。

## 防“0 tests”与可审证据的最低核对

1. 在执行前/结果内钉真实 checkout SHA + fe6四hash；无源/错误旧版本不得用测试数量掩盖。当前actions checkout L34–37未显式target输入，仅打印HEAD并summary GITHUB_SHA；后继需把选择的immutable run SHA与预期source核成同一事实。
2. c1实际两个子步骤都exit0；JSON恰1file/26规范名全部passed、0pending/skip/todo/failure，缺报告/空文件/import前0test/timeout均fail。名称规范pin `/private/tmp/msgquick-checks-c1/expected-tests.json` SHA `9e2a4aee3a3b351fbf0cdab56f09af171ea53508d37df13bfc49377f0b2cbf80`；后继需受控固化portable版本，不依赖本机路径。
3. b1是显式场景调用，不能以Playwright发现0test但进程结束充数。验完整六个固定字符串（b1 binding.expectedChecks）及顺序，包含真实HTTP first20缺profile21→after20 exact profile21/原C/A/B保留/一次Apply（fe6 browser L197–231）；检查两PNG非空并hash，真实CSS与390几何断言必须执行。
4. 原CI无upload/本机日志搬运。仅console/summary不足以供图片和完整26名称审查；后继需小而有界的结果JSON、exit/cleanup、source manifest及两PNG留存入口，按原owner/Lead独立审其artifact/permission边界，不在本报告扩workflow。失败/中断原raw保留，不把缺清理当平台销毁通过。

## 已核/未核

已做：固定Git对象/本地packet纯文本与hash比较，skills本地发现与方法应用。未做：Node、产品import、类型、Vitest、浏览器、PG、CI、网络/安装、free/proc；没有远程已授权/已启用/已通过结论。OPS工作树与c1/b1均未修改。技能来源实际文件hash与所有精确pins见 audit.json；沿既有本地版本，未安装或联网。Root另核GitHub官方动作/产物边界，本报告不重复该范围。
