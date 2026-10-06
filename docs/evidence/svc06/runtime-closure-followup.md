# SVC06 最小运行依赖闭包后继（仅设计）

记录：2026-10-06 14:41 UTC。owner assignment_review / gpt-6-astra；原 claim 3346 v4。本段没有改产品、安装、构建、PG 或 provider 调用。原 `6d276baee6d3fbf14eb4b638a9ad773ffcec988d` 的限定独审批准继续有效；完整固定产物没有变为通过。

## 决定与交付拆分

最窄后继是 **只替换 build.mjs 内的依赖准备策略**：固定源码布局不变，选 server/runner 的生产与可选依赖、五个 workspace importer，再显式纳入根 tsx；clone 仅这些锁定包实际需要的 CAFS 索引/内容。pnpm 仍是最终 peer、平台选择和布局生成者，不手工搭 `node_modules`，不换成 deploy、不写第二解析/安装平台。

已审保护片段可独立进入集成队列：源码 target `6d276baee6d3fbf14eb4b638a9ad773ffcec988d`，已固定且与它产品零差的交付 head `ad6d39f8c25ec1ffce493db71b3c8d49cb3394a0`。ready-queue 核到 main `59ef2134e1290c65782c06e577a10d660677f78a` 尚缺九个新 artifact 文件，五个既有 host/CLI/README 文件不同。接收这组已审、默认保持 legacy 的保护代码，不必等待 full build；但不能据此开放个人部署或宣称 artifact 正向可用。新闭包实现必须另固定差异与局部检查，不能继承旧批准。

## 已核输入与证据等级

原锁 SHA256 `0e6a99c258aa1f2333efc4cb83412875840c028e7a6d75f4735afbf9c5f8a20e` 已从本树实算；它不是 Git SHA。原只读清单为 [seed-closure-observation.json](seed-closure-observation.json) / [seed-closure-plan.json](seed-closure-plan.json)。本段固定事实、源码与工具摘要见 [runtime-closure-followup.json](runtime-closure-followup.json)。

GO 新输入报告五个 workspace importer、显式 root tsx、256/683 snapshots、256/581 cache indexes、missing/unsupported/cachemissing=0、保留 content 321,929,020 B、排除 186,269,334 B。Lead 已说明没有新增报告路径；这些数字保留为 **GO 只读输入**，本作者未重扫缓存或独立复算。排除统计含共享重复，不能相加倒推出分区，也不是安装字节、物理峰值或降门槛证据。

本作者只读确认：五个 workspace 是 apps/server、apps/runner、packages/contracts、packages/client、packages/protocols。tsx@4.23.15 在根 devDependencies，不能直接被 `--prod` 留下。运行根选择因此是这五个 importer **加根 `.` 的显式 tsx 入口**；不要把 GO 的“五个 workspace”误写成 pnpm 仅五个 importer。server 的 pg-boss 带 peer 上下文；runner 的 Claude SDK 带 @anthropic-ai/sdk/MCP/zod 上下文。MCP SDK 虽也列在 runner 的 devDependencies，仍可能是生产 peer 图需要的节点，不可按名称或 dev 标签删掉。

## 最小 Interface 与实现步骤（未执行）

外部 prepare/verify/host Interface 保持。增加一个私有、只读 `runtimeDependencyPlan`：输入固定原锁/相关 package.json、host 平台、固定 pnpm 身份；输出所选 importer/snapshot 完整 key、独立 cache file 列表、源码锁摘要、安装输入摘要及预算。未知格式、越界 link、未解 peer、必需缓存缺失都在 staging 写入/停服务前拒绝。正式实现使用固定可靠 YAML 解析器；优先复用 pnpm 工具已有依赖，不从 bundle 反编译内部函数，不新拉网络依赖。若无法稳定复用 parser，先给 Lead 一个精确构建期依赖请求，不能继续用 regex 当正式 lock 解析器。

1. 保留原 Git 源码树、workspace 目录层级和 SQL 资源。先生成有界依赖计划；完整 snapshot key 含 peer suffix，optional 子图和 os/cpu/libc 条件必须纳入，不能凭当前 `node_modules` 目录名反推锁。整棵锁的 metadata 很小，暂不做 packages/snapshots 表裁剪，避免再写一套 lock 重构器。
2. **仅 staging 安装视图**把根 `tsx` 的同一 specifier/version 从 dev 分类挪至 dependencies；同步挪原锁 importer `.` 的相同条目，不改版本、integrity、peer-qualified resolution 或其他 importer。保存原 manifest/lock 和确定性 delta、投影后摘要。安装前核除此两处分类外语义零差；`--frozen-lockfile` 校验的是明确标记的安装投影锁，绝不谎称直接用未变原锁就保留了根 dev tsx。
3. 候选 pnpm 选择表达式为 `--filter-prod @flow/server... --filter-prod @flow/runner... --filter flow`，并显式 prod=true/dev=false/optional=true。保留 offline/frozen/ignore-scripts/ignore-pnpmfile、空 user/global npmrc、私有 HOME/cache/store、copy import method。`filter-prod` 只决定 workspace 图，并不独自排除包内 dev；首正例必须核实际 selected importers 与安装集合，而不是把命令文本当成功。
4. seed 仅 clone 计划所列索引和内容：按 CAFS 文件路径去重，保留 executable mode 的 `-exec` 路径；拒绝源 symlink、未知文件和目标已存在，clonefile 单进程且无普通复制 fallback。布局仍是私有 `store/v3`；禁止把全局可变 store 或其他 worktree 链到成品。完整包内容保留，不对 SDK 私有文件 tree-shake。
5. pnpm 完成后验证安装投影锁未被改变；恢复源码根 package.json/原 lock 的固定字节，移除临时安装视图，不让运行流程再执行 pnpm。最终 manifest 单列 sourceLockDigest、installationLockDigest、projectionPolicy、selected importers/snapshots 与实际文件 inventory。所有相对 symlink resolve 必须在 artifact 内，普通文件 nlink=1；源码和依赖读取不得回到开发目录。

这不是已落地命令或可执行新许可。现 builder 仍全 store/全 workspace；后继预计只改 backend-release 下 build/私有 dependency-plan/clone 输入及专测，不修改 root lock、运行业务代码或维护 FSM。

## 必须保留的真实运行资源

- Claude SDK 0.3.290 的 sdk/core 模块、manifest/资源及 Darwin arm64 optional package 全内容；实际 sdk.mjs 的 `dq` 经 SDK-local createRequire 解析 `@anthropic-ai/claude-agent-sdk-darwin-arm64/claude`。只 import sdk 不足以证明这些文件完整；后继至少只读 resolve/stat/hash/executable-mode，**不启动 native CLI 或 query**。
- tsx 的 loader/CLI、esbuild 及当前平台 binary；ignore-scripts 前提下需后继用真实 TS 入口证明已有包内容足够，不能假定脚本生成文件存在。
- server 所有 migration 相对路径（例如 database.ts 的 002、context-transparency/migration.ts 的 027）仍落 `packages/storage/migrations`。该目录不是一个 npm workspace importer，不会由 `--filter ...` 自动替你复制；保留现源码 archive 布局解决。
- contracts/client/protocols 的相对 TS imports 以及包 exports；不 bundling、不只拷顶层入口。Node 和非 system dylib 沿原固定身份校验。配置指定的外部 Codex executable 不因 npm 闭包而成为已封装/已验证，仍属于既有 host 配置约束。

## 资源门槛与下一个局部正例

完整准备门槛仍为 **fresh ≥2.5 GiB，至少1 GiB留共享 DB/报告/其他任务**；本段约1.11 GiB可用，未准入。321,929,020 B 只是 GO 报告的逻辑内容，不等于新增物理空间；还需 clone inode metadata、安装 copy 后展开大小、peer 上下文可能重复、source/tar/manifest/cache/日志和同时留存产物。没有峰值实测，不降低 gate、不大复制、不做安装探测。

后继最小验证分两级，均需获准实现/资源条件而不是本次直接执行：

- 小型封闭 fixture：同私有 plan Interface 验证 root tsx 投影、peer-qualified 两上下文不合并、optional 平台与缺缓存拒绝、稳定排序/有界清单；原 lock 不改。只关切新策略，不重跑旧8观察。
- 一次实际正例：fresh gate 满足且 co-lead确认后，固定源+私有窄 seed，0网络/offline frozen/ignore-scripts，实际返回 installer exit、selected graph、全部内部解析与外链扫描；记录物理空间前/过程最低/后和逻辑/分配字节，任何失败保存证据后停止，不自动放宽或重试。随后同一成品用随机PG/动态端口启动真实server与fixture runner，证实SQL迁移/公开受理/产物/重启；对**自有受控 seed/源副本**做变更后延迟 import 哈希仍不变，不改开发工作树或个人服务。SDK optional仅静态核与import，无provider。完成checkpoint后才清自有资源。

“helper能生成256节点”或“CLI返回0”都不是完整通过：还要固定文件、实际入口、资源缺失拒绝以及源码脱钩正例。完整 host refresh/resume 与个人部署仍按原 SVC06-04/05，不能用本设计勾完。

## 技能与 clean-code 工作段

2026-10-06 14:41 UTC 实读本地 find-skills、codebase-design、clean-code（路径及SHA在事实文件补充）。本 stack 已有匹配本地方法，无新安装/联网搜索。将复杂度留私有构建 Module，外部 Interface 不变；原锁与安装投影、cache估计与物理峰值、旧批准与新候选分别命名，避免重复安装规则与部署状态权威。发现并明确处理 root tsx dev/peer/SQL三处遗漏风险；未解决项是实际 narrowed install 和完整产物正例，未用纯设计替代验证。纯文档只核链接、范围、固定摘要和一致性。
