# WPF-P01 技能与质量

2026-10-06 02:30 UTC；w01_owner，派发gpt-6-astra/ultra。先核新树不存在，再按管理者授权从main108f创建codex/web-plugin-host，merge已审W01最终a22ae38，无冲突后HEAD0673653 clean；后续只写派发范围。

按find-skills的domain/task方法，本任务是TypeScript生命周期模块+React扩展/错误隔离+行为测试。本地有适用技能，优先读取，不重复安装：`/Users/citrine/.agents/skills/find-skills/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`、`vercel-react-best-practices/SKILL.md`、`webapp-testing/SKILL.md`、`brainstorming/SKILL.md`；沿用已读assistant-ui/ai-elements用于真实组件adapter。clean-code固定来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，assistant-ui技能139674dc、AI Elements6a9d5b1。无技能安装动作。

架构设计已由用户授权并由主管理草案分解，本轮明确为X01 Web子项，不重新审批。codebase-design将权限/并发/清理隐藏在深host模块，至少两个真实adapter验证seam。React规则用于稳定immutable窄snapshot、懒加载与局部错误边界；webapp-testing用现有Playwright/Chrome与专用fixture端口，不停他人服务。工程验证沿现有TypeScript测试栈，不为使用Python重搭工具。

开工clean-code：审职责/边界/错误面，发现旧data-slot标记存在message/taskbar和通用workspace.actions等语义偏差，采用typed React slot而非扫描DOM；ErrorBoundary不能覆盖event/async，host方法明确catch并归属诊断；根token/client绝不进入plugin API。实现尚未开始，未宣称检查通过。

## 2026-10-06 02:44 UTC — host工作段clean-code

范围：types/validation/host与12项公共模块行为测试。发现并修复manifest JSON.stringify静默丢函数（先递归拒绝非JSON/访问器/循环）；staged renderer仅active可见；原CommandContext.execute返回OperationResult可被公共execute嵌套包装成功，按root提前反馈改为内部Promise<void>抛错，公共边界唯一OperationResult，桥失败/资源拒绝均顶层ok:false。generation清理、单次并发激活、动态授权、窄不可变订阅、主题fallback与整host失效通过12测试，Web typecheck通过。React/builtin/fixture尚未完成验收。注册表/Bridge单一职责继续在最终复核；同realm可信非沙箱。

## 2026-10-06 02:51 UTC — UI与交付前clean-code

范围：React bindings、两个真实builtin、第三sample、隔离fixture及完整host。实际修复：工作区tab改变不重挂载renderer（只按task身份重置）；sample menu实现真实菜单焦点/方向键/Escape；内部桥统一throw而公开调用唯一OperationResult，所有UI消费者显示失败；fixture补产品assistant-ui基础CSS并重拍双主题/390px图；主题fallback清理自有CSS token后验证实际值；disable只移除插件，draft在外层不丢。将menu定位CSS移到插件绑定自身，未要求App复制fixture样式。

独立root review提供PH-R1/P2 subscription同步/async错误隔离、PH-R2/P2原型slot拒绝，owner修复46164d6和3d81210并新增真实fan-out/atomic register行为测试。root对3d8121006fea24b6b9f25457eb363a10110781ad的五模块文件独立APPROVED且重跑14tests PASS；不覆盖新UI。完整候选d81075c的14模块+8browser+typecheck+fixture生产build通过；整体独立review尚待。

职责复核：validation负责输入声明，host封装registry/generation/authority/disposal，React binding负责渲染和局部错误，builtin仅桥接既有真实功能。没有DOM扫描、后端状态写入或重复协议。没有新增生产依赖/改公共契约，根lock完整patch后恢复。仍未解决/未验：M02主App接入与真实中心、未知第三方JS隔离、产品性能预算；这些是明确handoff边界。

参考root持续研究与本owner核读的官方文档：[React ErrorBoundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)、[VS Code extension anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)。显式loader重试再次调用load，不用失败React.lazy Promise假retry；插件普通event/async错误靠host命令和归属订阅边界处理。
