# WPF-CHATREAD01 聊天阅读空间

创建/更新：2026-10-06 08:24 UTC；状态：in-progress。继承 U11/REQ43，GO/root已批准有界方案，唯一owner workspace_panels_owner / gpt-6-astra ultra。

目标：1280×720和390×844中优先保留正文与composer空间。稳定profile/协议/能力说明归入可达详情；空queue紧凑，错误、过时状态、阻塞与未知回执在折叠外仍可见。原官方Thread、发送/Queue/IME/草稿/stream/profile身份语义保持。

固定base 32c371d389a913f8dd71c3bd8b98dd0697411256，独立web-conversation-readability / codex/web-conversation-readability；仅[status](status.md)七实现/测试文件及本任务plan/evidence，见[committed领取](../../docs/evidence/wpf-chat-readability/take-receipt.json)。不写App、officialThread、runtime、queue commands/outbox、shared或依赖；0模型/真实DB/个人服务操作。

方案：沿现Thread slots重组展示；profile用现Radix Dialog展示不可变请求配置，newchat目录选择保留，稳定说明通过展示slot组合，明确下钻由Dialog完成关闭后触发。locked摘要显示model/access/locked或receipt-pending，深层IDs/digest按需。Queue沿现AI Elements Collapsible，折叠外显真实警示，loaded empty才显示空；加载数不推总数。保留显式Execution入口与requested/effective区分，避免重复嵌套标头占位。

已确认：权限与命令不变；modal按Dialog语义（标题、Tab约束、Escape/Close回触发器，明确下钻转目标焦点），queue按Disclosure（Enter/Space/aria-expanded）；不自造焦点管理。假设待测：展示slot能收纳稳定说明且保留窄屏正文空间；通过实际前后rect验证，不事先设虚构收益阈值。

- [x] WPF-CHATREAD01-01：独立树、领取、技能与边界确认。
- [x] WPF-CHATREAD01-02：收拢稳定说明与profile展示、紧凑queue及折叠外异常。
- [x] WPF-CHATREAD01-03：同fixture前后rect/双主题/窄屏/键盘及消息行为局部验证。
- [ ] WPF-CHATREAD01-04：clean-code、固定实现独立review、证据与聚合交付。

验证：复用已存HTTPfixture，在产品修改前捕获固定尺寸/字体/数据/主题基线。记录composer header/footer、queue及正文可见区域真实px变化；截图不代替行为。新增本任务fixture/browser覆盖empty/waiting/paused/error/unknown、详情键盘/焦点、新输入保存、Enter一次/Queue一次/IME零提交/ShiftEnter换行。Web typecheck/build与必要直接消费者检查；不重复全库。review默认NOT_STARTED，main集成另记。

风险：长说明吞占composer；折叠隐藏错误；modal焦点丢失；折叠使控制无法触达。以显式异常摘要、原组件语义和真实浏览器回归控制。来源与应用见[quality](../../docs/evidence/wpf-chat-readability/quality.md)。

2026-10-06 08:30 UTC：固定b9db，前后布局/dev7/prod7与Web类型/构建验证完成；待独立review/main，见[验证](../../docs/evidence/wpf-chat-readability/validation.md)。

2026-10-06 08:38 UTC：root固定b9发现执行下钻被modal遮挡；527176c修复关闭/焦点交接，dev8/prod8与类型/构建通过，待独立复审。
