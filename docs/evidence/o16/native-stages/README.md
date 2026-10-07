# O16-06 分阶段实现与零模型局部检查

原候选 [candidate](candidate.md) 已获 Lead 授权，claim 55c4 v1 / 原三 literal，base f5a 产品与普通 adapter 不改。此交付是分阶段实验实现与局部证据，尚未独审，不代表 native/PG 旅程通过。

## Interface 与职责

- `stage-policy.mjs` 仅负责有限阶段、暂停绑定/期限、首错与收尾排序；不调度 runner、不删除 DB、不证明逃逸后代停止。`settleStage` 在关闭前保业务事实，关闭后保资源事实，最后才发布成功暂停；任何错误分别留存，首错不被 finally 替换。
- operator 支持 `--rehearse` 及 `--plan RUN PERMIT` / `--confirm RUN JSON` / `--children RUN PERMIT` / `--decide RUN JSON`。后四者各有独占 phase 目录/reservation/STOP；同 run 的全部阶段/raw 仍共享原 2MiB 计量和私有 8MiB 界限，沿原 120s work + 30s cleanup / 独立 150s watchdog。没有第二监督 loop。phase 目录已存在即拒绝，旧已消费窗口不复用。
- plan/confirm/children 成功后，pause receipt 绑定实际 proposal/两profile、source、完整 state/report/resource digest、marker/devino、注册组已止/center与pool关闭/目标库零连接观察。15分钟复核期限以关闭后实际时间起算；过期、改动、错误下一阶段均拒绝继续，绝不自动清理。恢复只消费一次固定 receipt，并在开连接前验证，restart前再核期限。失败/ACK未知保原intent/key/body，不自行重试或发布成功pause。
- native 模式当前在 operator、plan、phase-host 及直接 worker 入口均拒绝：登录来源及 SDK 其它写入位置尚未固定。该具体缺口不是资源/预算等待，用户 JSON 无法自授权。rehearsal 继续只用原私有环境；后继真实环境接缝必须另核固定输入。
- query 装饰器只在本实验将 `persistSession:false` 传入原唯一 iterator，保 abort/MCP/hooks 能力且复制 matcher 数组以免污染 adapter 原 input；resume/continue/store/fork 选项在消费 slot 前拒绝。普通 adapter persistSession:true 不改。这不声称所有 SDK 写入关闭，不引入 SessionStore 或 transcript 恢复。

## 本次局部证据

[validation.json](validation.json) 为单份分轮记录：16 different = 13 new + 3 受影响旧 decision 直接消费者。四轮 15(14/1)、5(5/0)、2(2/0)、1(1/0)，不是一轮16/16。第二轮 Node 汇总把两个空匹配文件也报pass，已剔除计数并在后两轮缩到单文件。首红是新fixture少了既有 PreToolUse 结构，补齐后没有放宽生产 gate。

原 [run-01](run-01/result.json)、[run-02](run-02/result.json)、[run-03](run-03/result.json)、[run-04](run-04/result.json) 的原件不覆盖。四组最终absent/双EOF，无signals；原pre-reap EPERM unknown观察保留，自有目录在checkpoint后正常移除。0PG、0SDK/native query、0auth、0provider、0浏览器/个人读取；旧26检查与真实旅程未重跑。末次之后仅将resources.workerProcess别名同步至同次已观察row，原事实数组/判断不改。

## 后继解除条件

先独审固定源；再由Lead协调新的零模型PG阶段消费者（本批未运行）。真实 native 要先固定既有登录来源、SDK其它写入边界和独立新阶段预算；plan实际proposal后才可确认/授children。旧FAIL/KEEP namespace和原已main零模型旅程完全保留。当前断言的是注册组/本次关闭，不是任意escaped writer撤销或工程资格。

## 技能与安全停点

沿已安装 find-skills / codebase-design / clean-code / brainstorming，本次设计以已批准b178为准，无安装或重复设计许可。采用一个stage-policy隐藏绑定/错误排序，资源生命周期仍resources所有，默认执行仍driver/原SDK loop。2026-10-07工作段自查命名、职责、不可变输入、首错与secondary错误、重复与直接行为覆盖；无需为同名函数造通用框架。只在合法三个scope写入；尝试独立只读协助因thread cap拒绝后未重试，独审由Lead统一执行。

早轮次源码变更也保持可核：[source-variant-bindings](source-variant-bindings.json)只收当前源不同的13个运行绑定/9个唯一文件。历史字节通过反向局部diff重建并逐SHA匹配**运行前已持久reservation**，明确是重建，不冒原时另存；原raw无改动。
