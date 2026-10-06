# WPF-RENDERER01 · 可信消息数据渲染模块

状态：in-progress · 创建/更新：2026-10-06

父计划：[Web 平台](../web-platform/plan.md)。Goal Owner 已批准这一个模块片；后续 App 接线另领，不扩大 X01。

目标：将消息 data type 映射到受信 React renderer，复用 P01 激活/停用/清理。现有 `flow-reply-detail` 为唯一真实用例；正文与按需详情在 renderer 缺失或故障时仍可访问。

固定基线：`fb906cb42391971a8b315dbd813f7633927d7265`。只写领取回执列出的 3 新生产文件、3 新测试与本计划/证据目录。没有 App、公共协议、依赖或 npm 生命周期变更。

方案：声明先原子验证，重复名字与 Flow 保留命名空间确定性拒绝；目录不执行加载。注册内容仅在 P01 active 生命周期中可用。每个 AssistantRuntimeProvider 各自持有唯一 wrapper 并清理自己的注册；不可依赖上游 first-registration-wins。真实回复 adapter 使用宿主绑定 connection/view/conversation/message/turn/task 的只读 port；mount/激活/主题/拆分不读取，用户展开后才调用既有详情读取。未知版本/无效数据不取得读取能力；有效详情的停用/故障退回宿主安全显示。

## TODO

- [ ] **RENDERER01-01** 实现确定性声明验证及 P01 生命周期注册表。
- [ ] **RENDERER01-02** 实现 provider 本地桥与绑定的回复详情 adapter。
- [ ] **RENDERER01-03** 局部行为测试、官方 Thread 双 provider fixture、浅深主题/390/键盘、固定独立 review。
- [ ] **RENDERER01-04** 下游 App 接线由独立 owner 领取并验证；本模块不能代记完成。

验收：冲突反序等价；未知名/版本/schema 和 renderer throw 可读 fallback；StrictMode/双 provider/单 pane 关闭/连接切换/disable 清理；详情 0→1→缓存、身份错配与迟到不串、新草稿不受影响。0 真实模型/产品 DB。每段和交付执行 clean-code，错误不得靠隐藏或删断言通过。

架构影响：新增仅 Web 的消息渲染 seam。待本模块审定与未来接线提交后，由 Lead 协调固定基线架构更新；不修改 D06。

证据：[质量记录](../../docs/evidence/wpf-renderer01/quality.md) · [领取回执](../../docs/evidence/wpf-renderer01/take-receipt.json) · [状态](status.md) · [审查](review.md)。
