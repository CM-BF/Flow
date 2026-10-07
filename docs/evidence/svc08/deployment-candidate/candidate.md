# SVC08 Web 宿主替换候选（只读设计，未执行）

本候选延续 FLOW-001 / REQ19。新 claim 仅 plan/evidence；原 086ba13d 修复及 main 15847da4 已交付，不扩大为个人部署成功。候选的结论是：**沿现有 Web 操作锁增加明确的宿主替换动作，复用现有启动/所有权模块；不能直接重用健康 Web 的 bootstrap 来声称已部署修复。** 当前没有可执行新命令、运行许可或新运行版本。

## 固定事实与差异

[inputs.json](inputs.json) 逐项绑定 16 份 Git 输入，含 af51 旧工具、已审修复叶子与保存的实际恢复记录。最新使用的个人事实是 **2026-10-07T02:45:34.853Z 保存的观察**，不是本次 live 检查。本次没有访问个人端口、配置原值、凭据、DB 或进程。

| 层 | 必须保持/变更 | 已知来源 |
| --- | --- | --- |
| Backend/runner | af51c621696230fbced12227670f014ca73bd8a1；accepting v18；center/runner 身份保持 | 旧恢复 facts-after；当时 4 success / 0 unfinished / 0 uncertain，不能推成现在事实 |
| Web 产物/指针 | d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88 / release v3；三个 retained 描述与兼容报告逐字不动 | 保存的 release 和配置 hash |
| Web 宿主代码 | static-web.mjs 从 af51 的 a8ac5d18… 改为已审 086 的 ca632440…（6800B） | source 086ba13dc0b284d04dbc3753c66471bf6012328a，main 15847da4b4aa00d42bd3e25b9bf88ea046bb19a8 |
| Web 进程 | 必须是这次操作确认拥有的旧 Web；未来会更换 PID/nonce | 保存的旧观察为 wrapper/group 27112、child 27144、record SHA e7ce6748…；当前 nonce 未公开保存，不能从旧 PID 或其他 nonce 推导 |

已读 af51 preview.mjs:49–55 要求 config.repository 与模块实际 repository realpath 相同，因此从本 feature WT 导入工具不能合法管理原个人目录。runService:223–258 相对自身加载 static-web；launchWeb:320–325 复用 owned spawn、pending state 和 readiness。bootstrap:327–353 在同一 operation.lock 内校验 marker、backend、release CAS、全部 retained 及其兼容；339 行对已健康匹配的 Web 返回 alreadyReady，不会装载新叶子。publish/rollback 只换产物指针，也不换宿主。

af51→main158 的 preview/CLI 已包含 SVC06 backendRuntime/产物入口差异；**不能整套 main 工具宣称是 af51，也不能改 state.source 欺骗检查**。本方案的待固定运行组合是 af51 工具闭包 + 已审 static-web 单叶 + 下述小型替换接缝，需独立审查组合后给完整 commit/树与字节表。目前 `NOT_CREATED`。若选择 SVC06 新工具作为基础，必须另验证旧 af51 配置路径，不自动继承该候选的兼容结论。

## 最小受管 Interface（后继产品，当前未实现）

建议 `replacePreviewWebHost` / `web replace-host`，保留原 bootstrap 的幂等/恢复含义。输入为同一目录、稳定 operationId、expectedVersion=3、expectedBackendHead=af51、current artifact/compatibilityId、expectedWebRecordSha256、expectedPointerSha256，以及受信固定 hostSourceDigest。完整可执行来源由宿主固定 registry/manifest 提供，不允许请求指定脚本路径、argv、env 或任意 Git ref。记录明确的“允许短暂断开 Web 连接”授权。

实现只在现 preview 内抽出共用的 locked Web validation/stop/launch 主体；replace 动作要求 previous release 存在，省略健康短路且从不 commit 指针。不要在外层先 stop 再 bootstrap（锁间竞态），不要复制 launch/权限/监督状态机。由原 scope owner 安全点接线或先正式交权。

同一锁内顺序：

1. 固定源闭包、私有配置/marker、expected Web record 与 owned nonce、backend/runner 身份及 release/兼容全部验证；变化或 unknown 在发信号前拒绝。禁止复用本候选保存的 PID 当新授权。
2. 先将 operationId、完整旧/新 host bindings、Web record hash、指针与允许变更集合写入持久 checkpoint。checkpoint 失败不 stop。重开已有 operationId 仅观察原结果，不能再 spawn。
3. 仅向确认拥有的旧 Web group TERM；复用现 stopOwnedProcess 的停止证明，无 FORCE。旧组未确认 absent 即 unknown，禁止启动替身。
4. 复用 launchWeb 和 pending record/readiness，只启动 Web。host provenance 另写 `webHost`/操作记录，保留 backend `state.source`、center/runner records。公开 artifact identity 相同只证明 d629，不证明 ca632… 代码已加载；需绑定新 owned record 与启动时固定源摘要。
5. 成败先写 durable 结果，再做一次有限 post 检查：新 Web identity/HTML、旧组 absent、center/runner/config/profile/maintenance/pointer/retained byte identity。不得借该检查发送用户消息。post failure 与 primary failure 分开；超时或记录失败均保留 unknown，不重试。

最小产品候选 literal：`tools/personal-preview/preview.mjs`、`tools/personal-preview/preview.test.mjs`、`tools/personal-preview/cli.mjs`，加独立后继 plan/evidence。static-web 已审叶子只作固定输入；如实现确需额外 host-source 封装或 CLI direct test，则先列新 literal，不在当前 claim 写。03:29 fresh ledger 显示前三项仍由 SVC06 / assignment_review 的 claim v5 持有，必须协调，不能因 docs claim 得到写权。

## 实际切换前的缺口和失败边界

- 尚缺新接缝产品、固定组合、直接 consumer/故障验证、实际当刻 owned nonce/marker 与源闭包，以及独立一次个人操作边界；本段仅使方案可审，不自创执行窗口。
- 主仓 source-window 只能由其受管 owner 固定/关闭。本候选不 checkout、overlay 或修改个人配置。必须证实新宿主必要 import 已固定加载，且关闭 source-window 后没有会从变化源码读取的 lazy 模块；未有此证据不开始真实切换。既有 Vite 8.3.2 固定依赖视图可复用，不能安装/换 donor。
- 外层复用 OPS14 childPidOnly 保护 operator，永不由外层杀 detached 用户服务；历史恢复的 28+0+2s/64KiB 仅是可复用预算形状，不是本次许可。模块最终 owned_state/EOF 与业务 ready 分开判断。
- Web 重启会断开当前 TCP/SSE/在途请求；保留页面 DOM、localStorage、URL namespace 和全部旧 lazy 资源，不等于连接无中断。丢 ACK 的操作继续沿原 key 恢复，不能自动重发用户动作。后台 center/runner 任务不被取消。
- 源、锁、进程身份或停止证明不确定即停止；新 Web ready 未确认则保留 pending/unknown。不能清理未知组、改指针救场或自动第二次 bootstrap。
- 回退是另一次明确受管操作：先确认新 Web 的确切 record/nonce，正常 stop 且 absent 后，使用同指针/retained/旧 host 固定字节重启 Web。未知则不得回退启动另一组。旧 host 源字节已由 Git 保存，但这不等于当前已有恢复入口或自动回退许可。

本次设计核验只读源码、固定记录、范围与链接；0 新工程检查、PG、Chrome、provider、个人探测或服务动作。旧隔离 FIN/RST 证据不能解释个人全部 64 CLOSED 的原因，也不能证明长期稳定。
