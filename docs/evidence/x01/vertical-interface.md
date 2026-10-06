# X01 首个真实包纵向片 Interface 候选

本页补充原 [X01](../../../plans/x01-plugin-management/plan.md)，不是第二计划或进度源。固定输入 main `7cbda706632c85fc5da12a371b282419c933ab9a`，受控同步 `c837853829f0344634df78ed7195ee7255f6b832`。Mika已授权设计方向；下列新公共字段/迁移/产品scope须由Execution Lead协调冻结，当前没有产品写权。

## 可交付行为与选择

一个同机、workspace级、显式 operator-trusted、无外部依赖的真实 npm text-tool fixture包，经**公开注册→固定版本fetch→install→configure→grant→enable→真实runner任务import/execute→来源绑定产物/现有verifier→disable拒新绑定**。自有loopback registry供应实际tarball；X04已有受控loopback例外，不向公网publish、不调用SDK。Web/TUI/CLI只消费同一公开中心合同；本片不能把一次CLI旅程写成三端UI已交付。

选同机明确storeId/runnerId的宿主配置；本地路径只来自受信operator配置，不接受command/manifest提供绝对路径。暂不新增远程分发端点。复用X02 immutable `plugin_revisions` 一次固定 version/config/grants，避免另造三个可漂移版本指针；新binding保存该revision和exact version/artifact identity。当前`select-version`清空config/grants不是完整rollback，后继仍需显式旧兼容配置选择。

没有选择：仅把X05 success改名installed（缺解包/manifest）；调用Web `PluginHost.activate`（是trusted浏览器realm，未绑定中心npm）；下载后直接向HarnessAdapter注入任意包（缺中心权限/host/task身份）。

## 状态与权威

| 事实 | 唯一权威与不变量 |
| --- | --- |
| registered/downloaded | X02注册声明；X05 operation与X04 artifactId/8MiB压缩字节/SHA512 SRI/SHA256。声明hash不是验证结果 |
| installed | 中心安装operation记录与同一store固定安装receipt：exact artifactId/version/digest、hostApi、entrypoint/静态manifest验证、安装树完整性。只解包/读JSON，不执行hook或package模块。默认disabled、不自动grant |
| enabled | 中心持久desired状态＋当前revision CAS；要求已安装、配置完整、授予包含所需capability、目标host匹配。它不证明加载成功 |
| loaded | 指定runner真实import后的有界receipt，绑定attempt/package/revision/host；不能由owner写一个loaded布尔值代替 |
| callable | 每次动作由中心在既有ownedAttempt fence下受理，核当时grant、binding/host/lease。loaded或enabled任一单独成立均不够；no grant/no binding不可执行 |
| completed/unknown | 沿原runner lifecycle/journal/ownerVersion；未知副作用/丢ACK不转成功或自动重试。runtime ref只有可信终结/释放证据后才结束，lease过期不证明包已停 |

首次scope是`workspaceId=personal, projectId=null`。项目scope/跨runner不默认继承。`trust=operator-trusted`由operator固定自有包digest允许集合授予，不由npm manifest自宣。trusted runner进程不是第三方隔离：不给包FlowClient/token/env参数不等于OS隔离；未知第三方保持不可启用。

## 最小模块与 Interface

| Module | 小 Interface 与职责 | 不承担 |
| --- | --- | --- |
| 既有 X04/X05 | 复用exact artifact、持久fetch operation、只读receipt/reconcile；安装消费已成功且精确匹配的fetch attempt | 不改旧success语义，不复制下载器 |
| 安装材料模块（共享纯文件职责，拟`packages/plugin-runtime/src/package-store.ts`） | `prepareInstalledPackage(artifact, trustedStore, signal) -> InstalledReceipt`；有界解包、静态manifest/精确npm name/version/hostApi/entrypoint验证、stage+atomic publish；相同receipt重读，不重新执行代码 | 不运行install scripts/entrypoint，不信任tar路径，不增加通用scheduler |
| 中心插件runtime领域 | `install/enable/disable`沿公开命令受理、原CAS/幂等/审计；`bindTask(tx, taskIntent)`固定当前revision/目标host；`authorizeInvocation(tx, ownedAttempt, binding)`核当前grant并记录调用身份；`recordExecution(tx,event)`绑定实际receipt/产物 | 不在事务里解压/import包；不复制runner权限、session或任务状态机 |
| runner PluginToolHost | `invoke(frozenBinding,input,{signal,assertOwnership}) -> boundedArtifact`；按operator同机store解析固定receipt，校验完整性并真正import，校验host API导出，再执行固定tool。runner用原emit/outbox报告真实状态与产物 | 不自选latest/config/grant，不拿public请求路径直import，不拷贝SDK transport |
| 既有任务/验证 | task受理+claim只接中心冻结binding与目标host；artifact exact version/digest由现有saveArtifact/flow.text复核；增加有来源binding元数据后中心核task/attempt归属 | package“success”不能直接令verification passed；插件verifier是后继独立验收 |

**公共最小身份候选**：`installationId, installationRevision, versionId, artifactId, packageName, packageVersion, sha256, integrity, hostApiMajor, storeId, runnerId, taskId, attemptId, ownerVersion, invocationId`。version/config/grants读取同一不可变revision；runtime refs/执行回报只能经authenticated runner+ownedAttempt绑定，客户端不传expected/current自证。

**公共动作候选**：复用register/configure/set-grants；新增install受理与可查询operation、enable/disable；新增固定`PluginToolIntent`及中心下发binding；使用原reportEvents处理有限plugin执行/产物来源。保留原X02 reader兼容，不能悄悄把旧`runtimeStatus:unavailable`当全局runtime权威。具体union及导出由F01冻结，客户端不私造HTTP。执行receipt是已授权runner的报告和归属证据，不是对包内部执行的远程证明。

**runner选择待F01冻结的最小点**：首片使用显式插件工具意图的确定性fixture carrier、真实runRunner与真实npm loader，不新增provider或通用harness。必须有中心登记的target runner/store/hostApi能力并在task受理及claim双核；现有仅`harness=fixture`不够。建议独立`plugin-host` capability记录/窄publish，挂原runner鉴权，不改native execution profile含义。未冻结此资格合同前不得用测试注入adapter宣称产品可调用。

## 生命周期、资源和恢复

- 安装与下载分别持久受理。install先记录固定operation/目标artifact和stage identity；事务外仅static prepare；结果另事务commit。请求丢ACK按原key查询。重启可对确切安装ID/receipt reconcile；部分stage/error/不确定保留，不能扫描后猜成功或自动重跑任意代码。安装执行可由有界受理调用驱动，先不新建第二常驻队列/调度器；对HTTP中断的所有权与显式reconcile须实现前固定。
- 压缩上限继续8MiB；首fixture建议展开≤1MiB、≤16 regular files、manifest≤16KiB、单文件≤256KiB、路径≤240字节。拒绝绝对/越界/重复路径、symlink/hardlink/device、未知entrypoint、依赖/install hooks；stage失败只清自有已识别文件，未知保留。最终数字是待review的首slice限制，不改X04全局限额。
- tool输入/输出建议各≤16KiB，单次一个invocation，先只支持无外部副作用的自有确定性text tool；错误用有限code、不能透传包stderr/全文到audit。trusted同进程仅协作取消，不能把Promise timeout称强制终止；无法确认返回时沿原unknown settlement保留引用。
- disable与接受新task binding在同安装锁/CAS下序列化，成功disable后拒绝新binding；已有task固定版本/config不热替换。grant收紧在新动作gate生效；一次invocation的中心受理是线性化点，之后已受理动作可能继续，不能承诺跨网络即时撤回或撤回已开始外部副作用。移除仍须disabled且没有active/unknown task/session/compression refs。
- 版本升级/rollback只改变未来binding；v1在跑时安装/选择v2后新task用v2，再rollback新task回v1/显式兼容配置；旧样本/审计/产物来源一直可读。首片只完成一个真实包v1的install-through-disable，后续版本矩阵保持原验收。

## 原TODO映射与验证

| 原ID | 本纵向片贡献 | 仍保留 |
| --- | --- | --- |
| X01-02/03 | 公共runtime动作、安装/绑定/审计字段；旧CAS/幂等/重启证据 | 完整升级/rollback/remove并发与未知矩阵 |
| X01-04/07 | 真实npm tarball解包+import+执行、固定binding、有来源文本产物与独立flow.text校验 | renderer、插件verifier、更多宿主/版本替换 |
| X01-06 | 同公开client/CLI语义可被Web/TUI消费；已有Settings只读入口继续 | 全Web/TUI/CLI写入旅程/主题/键盘/错误恢复 |
| X01-05 | 显式拒未知第三方；trusted限制清楚 | 隔离进程/容器与renderer独立document/message等完整安全验收 |
| X01-08/09 | 为未来唯一compression owner保留版本/ref及停用后读历史条件 | lineage/restore/fork/原文版本/损坏store/成本信息损失/native兼容，不宣称billion窗口 |
| X01-10 | 领域、真实load及中心组合各固定target独审，最后整体集成 | 原完整矩阵不因单包演示缩减 |

后续验证申请：先纯manifest/path/limits拒绝行为，再受控动态loopback registry+真实tarball+唯一正式迁移专库+真实runRunner公开链路（不是mock loader）；无SDK/provider。校验精确provenance、disable/new-binding竞态、当前grant gate、安装/replay/restartunknown、资源close/drop。版本v2/rollback/remove、第三方、renderer/verifier/context分别交付但继续原X01。当前只是设计，不跑这些检查。共享安装材料模块仅新增直接相对导入的TypeScript文件，不为这个复用点引入依赖安装、workspace包注册或新的全局alias。
