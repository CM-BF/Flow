# WPF-I01 独立审查入口

**状态：NOT_STARTED**

Review target commit：92a786abb9f7ef16e15482ac00b98ff860ecc47f

Base：`1002f2688c2b4d2e3a5723d94bdbe965a2a88626`（完整输入 merge）；M02 metadata `c526c1c889437ee39155d669921577995195c74e`，P01 metadata `2910ebc8e11fbcb00d1c2773face229c84fe47cd` / 已批准实现 `6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6`。作者新实现提交 253cfd11673c7f993ba7a741962ba74837b7db5c 与目标的窄屏 CSS 修正；metadata 不属于行为 target。

## 范围与验收

审查主 App 对可信 Web host 的真实挂载；精确 scope 见 [status](status.md)，方案见 [plan](plan.md)。重点：bridge 不泄露 client/token；局部 task/message/reference 身份；相同 ID 跨中心 active/hidden UI 与旧闭包隔离；真正官方 Thread ActionBar；主题 token/fallback；禁用贡献/监听/面板焦点；A→B→A/Notes roundtrip 状态保留；首屏详情 0→显式 1→cache；8 chat/双 split 观察预算。workspace.tabs 合法 panel/button/menu 均消费，动作在 tablist 外。X01 全栈、第三方隔离、持续真实模型对话、PTY/任意 fs 不在范围。

## 作者检查与进行中反馈

[验证记录](../../docs/evidence/wpf-i01/validation.md)：9 bridge + 15 direct host tests、9 HTTP fixture browser 组、3 真实隔离 PostgreSQL/public runner 旅程组、typecheck、build、production smoke 通过。明确区分真实协议与 live 模型。现有两个 >500kB chunk 告警保留。原始 lock patch 保留导致全量 diff --check 不能概括为通过，排除原始 patch 的实现/docs whitespace 检查另记。

root 在 moving tree 期间反馈 Settings 关闭焦点丢失、workspace.tabs 动作未消费；作者已修。root CUA 独立复验 Settings Close/Escape 回入口，但不以此代替本固定 target 整体 review。此文件尚无正式 reviewer 结论，不以空 findings 表示通过。

## 可复制只读审查任务

先核 tree、branch、live claim v1、base、完整 target 与 dirty。只读固定 target，不读作者 metadata dirty 代替实现。审阅上述行为并运行相应局部检查，区分 HTTP fixture 与真实中心、作者与独立证据。对每项 finding 给严重级别、触发路径、文件位置、blocking 与复验条件；修复交唯一 owner。固定target中 P01 本身没有作者改动。最终结论绑定完整 SHA，metadata 新 HEAD 不自动扩大行为 approval；原 Lead 负责 main 集成。

当前预览：http://127.0.0.1:55049/ ，HTTP fixture，owner 保持该实现冻结；不要停止用户保留的 M02 49922 服务。作者回应/正式发现/修复/复审：待独立 review。
