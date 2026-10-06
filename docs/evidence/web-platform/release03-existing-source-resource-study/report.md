# RELEASE03 复用既有源码/依赖的单 Web build 只读资源依据

结论：固定 SVC `84005a260dfcb668cd38b09c21564d0754a0f513` 的 `prepareWebArtifact` 技术上可以直接使用既有 ATTACHI 工作树和已安装依赖，避免 clone/copy source/install。必须申报该树实际 `sourceHead=5069586a9f17332de526e101eca3a4250cbc8d91`，不能填获审实现 SHA 9eec。这是一项更小的准备候选，不是已获 build 许可；没有执行 build、install、服务、浏览器、PG/provider、清理或任何项目写入，只写本 `/tmp` 报告。

最新资源裁决已纳入：2.5 GiB 门槛继续适用于 SVC06；新的单 Web 产物准备要先核实际峰值并保留约 1 GiB 收尾余量。本研究未测出峰值，也未宣称门槛解除。13:49 的 1,388,440 KiB 可用量来自 Lead，非本人的 fresh df/可预留空间承诺。

## 源码与依赖身份

- 本人只读实核 WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-attachment-production`，branch `codex/web-attachment-production`，HEAD `5069586a9f17332de526e101eca3a4250cbc8d91`，working tree clean，tree `f01fca67b9aa396ea6303fd2246c20c1d62d4277`。
- 对获审 `9eec51b72c6432b5b41df52f5b8fa783eb45e65b` 做**全 tracked tree**差异核验：47 路径全部在该任务 plan/evidence；`apps/web` 与整个 `packages` 的 Git subtree object 均相同，root package/lock/workspace manifests 相同。不只是24个声明源码相同；生产、测试、构建配置和工作区依赖源码均未变。完整对象及 SHA256 在 `evidence.json`。
- `prepareWebArtifact:26–30` 强制 HEAD=target 且 clean。新 manifest 应记录实际 506 HEAD/tree 和现 lockDigest，附实现 provenance=9eec；不会与以9eec标注的旧 descriptor 相同。
- 按 `createRequire(<WT>/apps/web/package.json)` 只执行 `require.resolve`（没有 import/build/plugin 执行）：Vite 8.3.2、React19.3、react-dom 以及 plugin-react6.1.2、tailwind-vite4.3.3 均 realpath 到此 WT 自有 `node_modules/.pnpm`。`@flow/client`、contracts、interaction 都解析到**此树** `packages/*/src/index.ts`，并非旧树的编译 dist，不需另一次 package build。
- 没有遍历/校验所有已安装第三方包完整性，不能把 lock 相同说成全部 ignored 依赖 bytes 审计完成。已核关键工具入口/源码哈希；未读其它 owner 依赖、个人目录或凭据。

## 正式入口的新增写入路径

固定 `tools/personal-preview/web-artifact.mjs`：

1. `75–79` 读取 sourceIdentity 和现有 Vite；没有 source copy、worktree 创建或 install。
2. `80–87` 仅复用完整验证且 sourceHead/tree/lock/node/vite/**releaseId** 都相同的正式 manifest。raw `/assets` 不符合，不能 import 冒充 format2。
3. `90–106` 在 operator 的私有 artifact directory 下创建 `web-artifacts/.stage-<uuid>`，子进程 build 写其中 dist；写 manifest 后原目录 rename 为内容摘要目录，不再次复制整套产物；finally 清理剩余 stage。新正常路径没有两份 dist 的复制步骤。
4. `108–113` 使用旧树的 Vite/config，`envDir:false`、production、fixture=false、指定 outDir/emptyOutDir、sourcemap=false；有32hex releaseId才生成 `/__flow_releases/<id>/` base。不会修改当前 published pointer，也不读取个人服务配置。

**不能说只写 stage/dist+manifest。** 实际 Vite 配置加载默认 bundle（已安装 Vite node.js:37707–37725），ESM 配置在最近 node_modules 写临时 `.mjs`（37901–37922），然后异步 unlink。该树最近目录为：

- `<WT>/apps/web/node_modules/.vite-temp`：真实目录、非symlink，当前 du 0 KiB；正常配置临时文件位置。mkdir 的 EACCES 回退会在 `<WT>/apps/web/vite.config.ts.timestamp-*.mjs` 写临时文件。故 future 授权须覆盖这两个自身临时位置，而不能拿只读 source 作为字面零写承诺。
- `<WT>/apps/web/node_modules/.vite`：配置默认 cacheDir（Vite node.js:37458–37466），真实目录、非symlink，当前 du 4 KiB。普通生产 bundle 的 resolve 路径排除 dev dependency optimizer（28940），没有看到该配置要求重新 prebundle 全依赖；仍不可把所有插件/native间接写入归零。这个 cache 是**WT 内所有使用同 root 的 Vite 共享**，不是 per-release stage；本研究没有声称运行消费者检查完成，operator 若执行仍需避并发 cache 操作。

Vite 输出准备 node.js:34020–34064 只清自身 outDir/可复制 public；此树 `apps/web/public` 不存在。vite.config.ts 只有 React/Tailwind 和 chunk 分组，没有自定义落盘插件。React production禁fastrefresh；Tailwind现入口使用内存Map/Scanner，未见直接 writeFile/mkdir/cacheDir 写入；native传递依赖/OS层仍未证明零额外写。Tailwind 默认扫描base是 Vite root apps/web，本树 CSS 只有 tailwind/tw-animate imports，无额外 @source；计划/证据在根 docs/plans 的 metadata变化不会因默认扫描直接变成新生产源，但最终字节仍必须 build 后实验。

## 体积依据与不可宣称的上界

- 已保留实际 raw artifact：`<WT>/docs/evidence/wpf-attach-i02/production-artifact`，10 files，**1,588,017 logical bytes = 1.514 MiB**；文件 `st_blocks*512` 为 **1,613,824 bytes**，du为1576KiB。这些是文件逻辑/allocated计数，不是 APFS physical-exclusive/reclaim 或未来 df delta。
- 这个 raw 是9eec最终浏览器轮的构建，已有 source manifest/10hash审计，**无releaseId/正式format2 manifest**。新base重写会改变HTML/chunks/hash，最终不能复用raw descriptor。
- 成功新增物理文件集合预计以一套约1.6MB dist+小manifest+短命config bundle为主；无依赖安装/源码复制，明显缩小已知持久写入范围。**约1.6MB仅历史终态量级，既不是正式format2准确大小，也不是 peak硬上限**。未测 plugin/native scratch、文件系统allocation/COW、进程memory引起swap、异常输出以及OS临时写入；不以“64MB上限”覆盖这些未知。
- MAX_BYTES64MiB、单文件32MiB和4096files检查在 `filesAt`，由 build结束后第98行调用；**是后置验收，不是运行中输出/峰值限制**。90s timeout也是时间限制，不是磁盘预算；stdout maxBuffer64KiB只限制进程捕获输出。不能用它们证明 build 期间写入≤64MiB。

## 交 operator/root 的最小候选（尚待裁决）

复用上述 clean WT/deps，明确 target506 + approved9eec provenance，以固定84005正式工具、固定新32hex releaseId和自有 private artifact directory完成**一次**正式单Webprepare；不clone、不install、不build整workspace、不读取/切换个人目录，不碰CONTEXTI active依赖。正式执行前重新核源码/可用空间与同WT Vite消费者；如要实际测峰值，须由root/operator明确许可和监测/中止预算，给约1GiB收尾余量，不能由本报告自行启动。只读结论支持“小写入候选值得评估”，不支持在当前可用量下直接宣称安全。

新descriptor仍须经过真实backend362兼容矩阵与既有attachment context_observation缺口裁决；该功能门槛不会因资源方案消失。本报告不申请改变公共行为、不当SVC发布许可。

方法/clean-code：复用已读本地 find-skills/clean-code，按 source identity、工具副作用、cache归属、测量单位分开核验；没有引入新脚本至项目或重装方法。`evidence.json` 包含固定工具/配置与实际安装入口hash、全tracked差异和raw文件计数。
