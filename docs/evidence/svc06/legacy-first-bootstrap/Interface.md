# 首次 legacy → artifact 的维护入口直接消费者

实施始点：2026-10-07 11:08:47 UTC（fresh ledger observedAt，随后本目录首次写入）；不是 SVC06 任务首次开工。原 claim `3346a60d-0b50-4c73-bf22-9b258f8b1381` v8 active，范围仅本 evidence 与原 plan。实际 PG：**NOT_RUN**，须 Lead 审查及共享窗口后单次执行。

本用例补 [个人候选](../update-diagnostics-candidate/candidate.md) 中 r2 未覆盖的首次身份。固定产物 7d1/source6c 与 [r2输入](../diagnostics-host-bootstrap/inputs.json) 原样继承；不重新构建、安装、查询模型，不读取或更改个人安装。原 r1/r2 结果与旧私有根保持。

## 场景与断言

1. 在全新 0700 namespace CoW 迁入同一 7d1，按原 manifest 完整验证。安装 `config.repository` 为真实 Flow root；`state.backendArtifact` 属性始终不存在，`maintenance.json` 原本不存在。缺策略文件保持默认 off。
2. 只通过产物原 `migrate` / `migrateRunnerMaintenance` 初始化 canonical 1、2、16；用原 `registerRunner` 创建真实自有 runner 身份。无 HTTP server / boss / runner 执行器，0 tasks / attempts。三个 `spawnOwnedProcess` idle Node 子进程只满足此消费者的既有 nonce/组身份门，不监听、不执行工作。它们不是三个实际服务。
3. 产物自身公开 `maintainPreview({directory,action:'bootstrap',backendId})` 必须 `CONFIGURATION_IDENTITY_MISMATCH`；前后数据库仍 accepting/version0、audit0，operation仍不存在，state/config/pointer 原 bytes 不变。
4. 从真实 Flow root 的固定同字节 `tools/personal-preview/maintenance-host.mjs` 调同一公开函数，显式 `backendId:7d1`。不调用会先选旧 maintenanceRuntime 的 CLI，不写假 state、不替换 spawn/Pool/FSM。原配置身份、marker、runner token、preview lock、完整产物/报告检查都执行；该函数真实创建 `operation.backendArtifact` 并 drain。
5. 再从产物入口调用 bootstrap/status，读回同一个 op、draining/version1，audit **恰1**。operation 与 state/config/pointer bytes 不变，三 idle owned 组仍 running、tasks/attempts0。这里只证明进入并接续原维护 FSM；不再 refresh/resume/cookie。真实三角色与刷新恢复另据已审 r2。

本用例沿 r2 的合成 v1 loader 材料构造必要 release pointer；材料明确 `NON_PRODUCTION_LOADER_FIXTURE`，不代表真实 App 兼容，不进入个人候选，不能满足三个 retained App v2 报告缺件。

## 复用与增量

- `supervise.py` 与 r2 **逐字相同**，仍调用固定 OPS14；不另实现监督循环。`entry.mjs` 沿原 r2，唯一新行为为固定输入继承/小 delta、fixture helper 复制路径、legacy cleanup 身份门。clone、资源采样、private checkpoint、work-absent 后允许 DROP 等实现不变。
- `inputs.json` 引用原完整输入 hash，不复制 514 项。新增 35 个 root 维护静态闭包 blob，另加实际使用的 `002-reconciliation.sql` 共36项；7个已解析第三方 package/entry 与 root alias 另 pin；root pg/zod 的15个实际递归依赖包共978文件/6,609,996B，逐字对7d1既有inventory绑定，只保存15条前缀引用而不复制文件清单。原4 legacy alias加18 root/传递依赖alias共22项核真实解析。执行前所有新增/继承输入 fresh 核，不将本次准备读值当执行证据。root closure 必须仍与 6c 同字节；主线其他路径不必整体切换/冻结。
- Node/OPS14/clone/d629 内容及 artifact manifest 沿原 pinned 方法。原工具中动态 build/yaml 分支不调用。实际维护模块由产物 tsx loader 载入，root 的 pg / contracts zod 依其本地已固定 alias 解析。
- `legacy-state.mjs` 是实验 cleanup 的小约束，要求 state 仍无 backendArtifact；operation 缺失允许负例后收尾，存在则必须同 artifact/source/opID、`drain-requested`。它不写业务状态，不授权恢复或 rollback。

## 资源与失败

原 work180s + cleanup30s，各 .5s TERM / 2s reap，fresh≥2.5GiB（另叠并发实际预算）、live≥1GiB。沿676MiB规划/64MiB额外文件/96MiB专库/2MiB raw；367,041,727B 是完整产物逻辑上界，不宣称 APFS CoW 为零物理成本。新 namespace `/private/tmp/flow-svc06-legacy-first-bootstrap-20261007-r1`，已存在即拒绝，不复用原 run。

最大配置连接：work pool1 + 单次 maintain pool2 + marker 检查临时 pool1 = **4**；各维护调用串行、negative在创建pool之前拒绝。cleanup的admin1+marker1上限2，独立工作组 absent 后才 DROP；没有server8/boss3配置。动态端口仅用于合法配置并随即释放，3 idle角色无监听。

独立 cleanup 复用原 nonce helper；先核新 reservation dev/ino/artifact 与 config/DB身份，再停止最多三个已知组。未知工作组、未知 nonce、operation不符、marker/OID不符或零连接无法有界确认均 KEEP；不以瞬时零连接代替工作组 absent，不强杀、不 FORCE DROP、不删保留根。首错与独立cleanup分别保留。中断前尚未写全 DB 身份只能 UNKNOWN，不能猜测回收。

局部检查只选新增 cleanup guard 3例、entry/journey 语法及唯一 status parser，0 PG/import/个人读取，≤30s累计/≤8MiB自有tmp/≤128KiB raw；实际 PG 单例整个入口仍 NOT_RUN。使用已安装 find-skills/brainstorming/codebase-design/clean-code 方法：先固定最小消费者接口与状态所有者、复用原 FSM/监督/clone、将实验cleanup资格与产品身份分开；不安装技能或新增平台。
