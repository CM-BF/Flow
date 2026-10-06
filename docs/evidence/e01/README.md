# E01 auth 首片段证据

2026-10-06：唯一 owner runner_owner / gpt-6-astra，独立 harness-auth-probes worktree，base b5b4ce21bd8ae5e0fd729c526226e8f8a49a7a47，开工 clean；协调 claim4c525d50 v1 active，scope已核验。

本地 find-skills 方法：Node/TypeScript 上游源码行为 spike 与隔离 I/O seam 匹配已有 codebase-design、tdd、clean-code；实际读取这些技能及 brainstorming，未安装无关 auth 技能。clean-code 固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。技能要求设计与测试 seam 已由 Lead 明确授权，使用简短 spike 设计，不重复要求用户审批。应用：最小 helper seam、分离上游代码和注入、有限可证伪行为案例，不让试验变成产品依赖。

已确认 @ai-sdk/harness-claude-code1.0.143、@ai-sdk/harness1.0.139，均 Apache-2.0；最小副本/完整 SHA256 见 experiments/harness-probes/auth/provenance.json。doStart 在870行直接 await resolver，未在该 auth await 传入 startOpts.abortSignal；这只是源码事实，是否挂住/并发结果必须由后续合成案例观察。

## 实际观察

固定源码 target：**8e232a0c2f52fd08565c2d377215c9d3a8904641**。源码提交前运行，所提交3个MJS字节与已执行版本一致；[probe-source-hashes.json](probe-source-hashes.json)保存这些字节的SHA256。原文副本逐字对照安装来源并通过；3个MJS `node --check` 与提交diffcheck通过。没有运行产品全套检查，scope未改产品或依赖。

2026-10-06 **03:04:13.898–03:04:15.390 UTC**，Node24，9个场景全部完成探针断言，总约1.49秒；这不是上游可靠性通过。原始 [auth-observations.json](auth-observations.json)，44,974字节，SHA256 **bb7d3f9ba09b354cab5a517c7211959b9b2267d0160594ecf7e7698b3bacee68**，提交后不得覆盖。

| 场景 | 直接观察 |
| --- | --- |
| 文件优先级 | 有效文件优先于合成Keychain，即使文件过期；file refresh返回400时抛错，不回退到合成Keychain中的新鲜值 |
| 来源写回 | 文件来源刷新写文件；无有效文件时合成Keychain来源刷新只写合成Keychain。自定义配置目录缺文件时不回落默认Keychain；显式env凭据不读subscription |
| 阈值 | now+300001ms不刷新；now+300000ms、299999ms及已过期均刷新 |
| 同PID2 / 16，单次轮换策略 | 发出2 / 16次fake refresh，全部使用同一旧token；成功1、失败1 / 15（HTTP400）；成功结果持久化 |
| 同PID2 / 16，所有响应成功+受控文件交错 | 各自只有一个PID tmp路径；成功1、失败1 / 15（ENOENT rename），均无剩余tmp文件，最终文件权限600 |
| 返回值与持久化值 | 本次16调用共享tmp案例：成功caller返回synthetic-access-05，文件却保存synthetic-access-16/refresh-16；2调用本次一致。不能将发生率外推 |
| 无额外取消策略 | fake fetch未收到signal；调用者取消后150ms helper仍pending；父进程约704ms SIGTERM结束，退出不是helper自行响应取消 |
| 显式注入fetch策略 | timeout约62ms产生TimeoutError；caller cancel约33ms产生AbortError。该策略是试验注入，未进入产品或上游 |

所有案例 forbiddenCalls=[]；真实网络/refresh/Keychain/模型调用均0。原始JSON中的token均为显式 `synthetic-*` 标签，没有读出或输出真实凭据。全部子进程已结束、临时目录由父进程清理。最初开发试跑在/tmp，未作为本表最终数据；本表仅绑定上述保存的原始文件。

## 方法、复跑与限制

[探针说明](../../../experiments/harness-probes/auth/README.md)记录复跑命令、调用链、I/O注入差异、屏障交错与进程超时。最小上游模块原文/许可/hash在同目录upstream与provenance.json；loader没有修改上游函数，也没有引入整个harness成为产品依赖。

有限观察支持：使用这个helper做并发native auth前，需要独立处理刷新互斥/轮换、持久化与取消时限；不能仅凭包内PID tmp路径视为并发安全。未测真实服务端策略、真正Keychain、跨PID协调、模型、完整doStart或Flow系统闭环，不据此宣称真实登录已修复。注入fetch的timeout/cancel只是可行的seam证明，不是产品修复。Paseo RPC留下一有界片段。

03:04 UTC clean-code复核：区分原文、VM依赖注入、场景、父进程清理；将所有可能挂起的helper调用关在有硬看门狗的短子进程。未知依赖/默认home/默认网络/外部命令失败关闭；清理不修改共享目录。上游自身并发/取消缺口是本实验输出，不在本scope修第三方包；没有新增产品实现。

## Paseo 第二小片段

固定源码 target **db2f2d0f6c2b0db3cab454d6cfe617b4671196b1**。raw SHA256 **a123e8e560f595bf12b1bc26d771c2699c1debc27f85c9e2c4bb032368d52c7a**，1,378字节；不覆盖auth原始JSON。

固定 FLOW-002 来源 getpaseo/paseo@7a30305503c600bc46ea2a94a6750eac5cede278，实际 checkout clean；`jsonl-rpc-process.ts`、`jsonl-frame-decoder.ts` 与LICENSE逐字/hash核对。最小副本来源/注入说明及复跑命令见 [Paseo探针](../../../experiments/harness-probes/paseo/README.md)。auth原始文件hash与源码target8e232a0保持不变。

2026-10-06 **03:09:29.503–29.717 UTC**，Node24.20.0，约0.214秒。真实合成Node subprocess/pipes + decoder公开入口；[原始JSON](paseo-observations.json) 从已运行/tmp文件逐字保存，不改结果。两个MJS语法检查、逐文件Git固定commit字节/hash对照通过；[运行源码hash](paseo-source-hashes.json)。

| 场景 | 直接观察 |
| --- | --- |
| 中文/emoji跨字节chunk | 真实stdout chunks为64/7/6 bytes；期望`中文🙂`，得到`���文���`，matches=false。源码逐chunk toString对应这一缺口；未修改upstream |
| 2MiB无newline行 | newline前0 frame/0 problem，收尾后完整恢复2,097,152字符；这个范围没有触发行长度保护，不外推无限内存/容量 |
| 子进程退出时pending | 两个无请求超时的pending均拒绝，约24.6ms；实测exit7、process closed；退出后stop-work调用完成 |
| stderr边界/脱敏 | 保留末8192字符，本次ASCII亦8192字节，旧prefix已截掉；合成secret marker仍保留，未自动脱敏。实际凭据从未使用 |

开发初次启动遇到Node父进程未启用VM命名导出、类型擦除留下空child_process import，均在进入上游案例前失败；修正仅加载器，不改上游源码。最终JSON仅记录修复后的实际probe。03:09 UTC clean-code复核：来源/合成fixture/公开seam分离，输出不包含大字符串或假装真实secret；独立进程组3秒hard watchdog，正常实际退出并清理，不触碰其他服务。上游完整tree-kill、V2 chunk协议、真实CLI与模型未测；0模型/云，不能作上游整体通过结论。

## 独立审查事实

Goal Owner已只读方法审查APPROVED auth固定8e232a0：完整模块/证据和10个复制文件/license hash、raw/9场景吻合，无blocking，未重跑；批准不扩展真实provider policy、频率、跨进程或完整SDK启动。Paseo target db2f2d0 已另获 Goal Owner 独立方法 review APPROVED，原文/许可/raw吻合，完整probe/fixture/RPC/decoder已读，未重跑；采用前须修 streaming UTF8、byte bound、redaction。两个结论不得合并成“整个上游已通过”。

03:14 UTC clean-code / metadata 复核：两个原始 JSON 和探针源码不变；分开记录独立审查范围、实际观察与采用前修复条件。下一工程对照仅做提案，现仍 0 模型/云。

## 原生/包装层工程对照准备

2026-10-06 03:17 UTC，只读核验本机 SDK0.3.290 d.ts 与 wrapper1.0.143 调用链，[固定文件hash](comparison-source-hashes.json)。stock bridge固定SDK0.3.281/CLI2.1.281，未透传budget/settingSources；query使用abortSignal而当前SDK公开Options为abortController；默认preset和usage映射亦不同。上述是源码事实，不是新模型行为结果。完整差异、官方依据、新预算/认证/模型权限边界与验收见[提案](../../../plans/e01-harness-probes/native-wrapper-proposal.md)。

本工作段仍复用本地find-skills/codebase-design/clean-code方法：只从必要interface查版本/参数/副作用，将可比较profile与stock差异分开；不引入产品依赖、不给缺失auth加自动fallback。clean-code复核未修改探针实现；修正草案观察时间为实际UTC，未留未来时间。链接/diff/source hash检查，不为文档重跑模型或旧测试。
