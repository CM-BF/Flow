# HOME 对照：实际薄入口

这是已审 c5fc960fc/b9b7f9ef8 recipe 的唯一实际装配，不改变原策略、原件或旧 namespace。`run.py --run-home-factor-once` 只接受固定准备文件与资源 owner 明确授予的 `O16HomeFactorGrant`；当前没有 grant，未运行 native。

入口先核 cwd/Python、固定 pins、grant 身份和当前 floor、未消费目录。operator 在同次调用紧前核 active claim v1/exact3、分支及认证无冲突，并保留 receipt；这些合作事实不是 OS 排他承诺。grant 绑定 preparation SHA，不能通过 JSON 换 argv、HOME 策略或认证命令。只有 `execution-grant.json` 是未来按正式 grant 新增的调度材料；source 和 preparation 不随窗口改变。

## Interface 与生命周期

| 责任 | 固定输入和输出 | 错误及释放 |
| --- | --- | --- |
| run.main | Python/cwd/pins → 0700 exclusive namespace、0600 outer reservation | 旧 namespace 拒绝；只监督自己新 caller PID，缺 inner receipt 不推断 native 已退出 |
| worker | 实际 Node prepare → 原 sourceIdentity/environment binding → A/B | 原 Node preparation 7+.5+2s；同 cwd/config/tmp/USER，14 项环境唯 HOME 不同 |
| native case | 同 2.1.290 binary，固定 `auth status --json` | 每次10+.5+2.5s，64KiB 内存输出；最多 A/B 各一次，UNKNOWN 停止，不第三轮 |
| public interpretation | 原 safe_status + home_factor；只四白名单及监督事实 | 原 stdout/stderr 不落盘、不 hash；原 exit1/first_failure 完整保留，只有已审 negative-status 组合可继续 |
| private accounting | 原 meter，8MiB/128项，safe records128KiB | 不读文件正文；超过/未知保留。private KEEP，不删除共享认证状态 |

独立 OPS14 外层监督完整 worker，工作截止为入口单调时间+42.5s，外层 TERM .5s/reap2s；完整受管执行上界45s。每次 native 前至少留14s才启动，其13s封套不主动跨外层停止边界。原固定输入检查和记录若挂起、外层被迫停止 caller 而 inner receipt 缺失，结果仍 UNKNOWN/KEEP；外层 PID absent 不等同内层组全部收束。最终安全记录写入不产生新的 native 操作。原监督器不改，不增加第二套监督循环。

正常同账户 native 初始化及必要 refresh 可能触发默认 HOME 辅助锁、文件 fallback 或 Keychain 条件写入，不能声称这些写入位于 private8MiB 内。caller 不读、复制、链接、手改凭据，不 login/logout/setup-token/换账户或 API key。A 可能影响随后 B 的共享认证状态；结果仅为可见性观察，不是纯因果实验、模型资格或 query 成功证明。

## 有界直接消费者

`run_test.py --selected-home-caller` 显式选择8个例；真实 run.main 的 pin/grant/namespace/持久化及 OPS14 Launch/Policy 纯校验保留，最后 supervise 替为受控合成结果。worker 例复用原环境验证和白名单解释，只注入 preparation/native 输出，不执行 Node prepare/native、不访问正常 HOME。覆盖合法 A→B、A未知不进入B、参数/身份/过期/占用/固定源/目录复用/symlink/期限拒绝与 raw 不外泄。此验证不证明真实 native 启动或认证可用。

find-skills / codebase-design / clean-code 方法沿原固定技能来源：职责集中在薄调用编排，策略、解析、计量及监督均复用；本轮检查命名、原错误保留、一次性所有权和缺证据拒绝，没有新增通用调度或认证框架。
