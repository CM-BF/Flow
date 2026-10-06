# Codex 0.154 macOS bootstrap：只读事实与边界选择

记录时间：2026-10-06 11:51:42 UTC。WPF-MATURE-02 / owner chatui01_owner / co-lead mika。接收 architecture_read / gpt-6-astra 于2026-10-06 11:49:19 UTC的固定来源只读结论；本owner仅整理交接，未重做运行验证。状态：等待GO策略/证据边界选择；本页不授权实现或运行。

## 版本与证据边界

官方 `rust-v0.154.0` annotated tag `36eab01061df3cde5f95ec20a526777b430091ba` 指向 commit `6b9826e3aa83b1a5947db50f4332cb9c65f1b340`；[Cargo.toml:152](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/Cargo.toml#L152) 所述版本为0.154.0。本地 `/tmp/flow-e02-schema.6svf7w/local-provenance.json` 只记载version/app-server help/schema操作，没有sandbox help归档。固定[CLI源码](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/cli/src/lib.rs#L89)声明`log-denials`，但已安装binary与该发布源码的可复现产物链未证明，不能称本机已验证支持。

此前v3报告SIGABRT、无子报告、file stdio streams=null；父regular身份不替代子syscall观测。必要性、拒绝规则和因果仍unknown。下面仅有三项固定源码差异：

1. **非文件bootstrap操作。** [平台默认policy:43–50](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/sandboxing/src/seatbelt_read_only_platform_defaults.sbpl#L43)允许`vnguard`以及`mac-policy` Sandbox/syscall67；注释指向container判断。现candidate默认deny，主要补充系统库/缓存读取，未包含两项。这说明补库路径不覆盖全部平台操作，不能证明本次SIGABRT由它们触发或发生在pre-main。
2. **明确命名的runtime查询。** [base policy:24–77](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/sandboxing/src/seatbelt_base_policy.sbpl#L24)包含命名`sysctl-read`清单（如hw.pagesize、kern.usrstack64），现candidate没有此类grant；本研究未证明任一项对本C程序必要。[组合逻辑:1021–1039](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/sandboxing/src/seatbelt.rs#L1021)还合并动态文件/网络与可选平台规则；上游完整policy涉及/private/var/db、/etc、Mach、syslog及sandbox extensions，整体套用会扩大现授权边界。
3. **stock拒绝日志不满足本任务边界。** [seatbelt debug collector](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/cli/src/debug_sandbox/seatbelt.rs#L87)先全系统实时`log stream`（不是历史`log show`），无源端owned-PID过滤/字节上限地收NDJSON，之后才按PID集合过滤；capability参数可能含路径。[PID tracker](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/cli/src/debug_sandbox/pid_tracker.rs#L185)在目标spawn后启动，用kqueue/proc_listchildpids，没有PID generation身份保证。短命后代、PID复用或解析丢失的完整性未证；“None found”不能证明无拒绝。停止链缺专用deadline、byte bound与ready handshake。因此不直接调用stock `--log-denials`，不保存其全量原文。

## 两条小后继，尚未选择

| 候选 | 可提供的判别证据 | 代价与放行条件 |
| --- | --- | --- |
| 先获取有界自有PID拒绝证据 | 若可靠归属，可缩小下一项grant候选；缺失仍unknown | 当前没有满足采集源端owned PID/时间身份限制、生命周期及字节上限的固定实现。须先形成可审方案，不采用“先收全系统再过滤”；只读标签不豁免秘密隔离。 |
| 申请一项明确限定bootstrap grant作对照 | 只比较选定操作是否改变同一目标的可观察结果，不宣称全部隔离或根因 | 必须先选定一项操作/一个精确名称及安全边界，GO新明确权限与新窗口后才可能实施；不能把syscall67、vnguard和sysctl整组猜测授予。 |

直接复制完整上游policy或使用stock日志收集均扩大边界。下一动作只等待GO策略/证据边界选择及Root明确方案审查；没有新target、profile grant、helper或日志collector实现，没有编译、CLI/help、系统历史扫描、私人crash读取、SDK/provider/auth或网络探针。停止重复fd变体。

本页是v3封存后新只读阶段：d803结果archive及be36正式review字节记录各自仍为历史固定快照，新文档不倒计为旧运行完成时长或更改其hash。方法沿本地openai-docs、find-skills和clean-code（sickn33固定bdacd76）；检查版本分层、未知结果、职责与权限边界，纯metadata不重跑工程测试。当前[官方安全文档](https://learn.chatgpt.com/docs/agent-approvals-security)及[开发命令文档](https://learn.chatgpt.com/docs/developer-commands)仅作方向参考，不替代固定版本证据。
