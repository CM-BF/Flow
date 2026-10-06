# TODO-11 快速设置：键盘/读屏验收的三个窄补充

固定源 **c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05**；只读 QuickControls 基线，未读 owner 新实现。以下是已接受设计的验收细化，**不是现270c leaf审查撤销，不是实现/运行通过或新blocking认定**。8个固定blob及本地方法/既有证据SHA256见audit.json。

既有基础正确且复用：`apps/web/src/execution-profiles/ExecutionProfilePicker.tsx:109–115,127–134` 使用真实Dialog标题/描述、native radio及fieldset；`apps/web/src/components/ui/dialog.tsx:9–15,38–50` 包装Radix并保Close；CSS `execution-profiles.css:4,9,28–30` 已有有界滚动、焦点样式、窄屏/减动画。原browser `:79–85,109–121` 只证明既有leaf的定向focus+Space、普通Escape和details宿主交接（本轮未重跑），不自动覆盖新4分面/暂存Apply。

已排除重复：ownership report已覆盖≤32完整声明tuple、零匹配不猜值且可清筛选、唯一草稿同步CAS/Apply和omit、same-tuple ABA、A/B/C、取消/关闭/导航/卸载per-opening liveness。本报告不再设计token、权限、host/plugin或回调状态机。

## 1. 已应用值必须进入触发按钮的可访问名称；暂存值不能冒已应用值

**确切源证据：** `ExecutionProfilePicker.tsx:110–111` 的显式aria-label仅包含model，而可见副文案另有thinking/effort/speed；`:147–150`已存在可复用的人读摘要。旧UI即时onChange，`:123–125`仅一份“当前草稿设置”；新设计将同时存在C和局部Y。

**最小触发例：** C从相同model的标准/高力度改成快速/不请求力度，按钮的aria-label仍同；读屏按钮列表单靠其名称无法分辨改变。新面板若把Y仍叫“当前草稿设置”，未Apply时会错误表达宿主C已改变。此为静态可访问语义缺口，不声称已用读屏器复现。

**验收补充：** closed trigger提供完整、简短的已应用C摘要（模型/思考/力度/速度，undefined明确“不附加”）；Dialog分别命名“当前草稿已应用设置”与“待应用选择”。仅host返回applied后更新已应用摘要；stale/unavailable须程序可读且明确未更改C，保候选；不能仅靠颜色/disabled或静默关闭。可把简短原因与Apply用aria-describedby关联，单一status/alert出口避免每个键入重复宣读。技术ID/digest仍在原details，不塞默认名称。

## 2. 四个分面的真实键盘语义和单一提交动作尚未被旧验证覆盖

**确切源证据：** `ExecutionProfilePicker.tsx:127–136`目前只有一个native radio组、选中直接onChange；`message-settings.browser.ts:79–85`直接focus+Space，`:90–94`使用check。没有分面Arrow/Tab/Shift+Tab、暂存不提交和显式Apply的真实键盘旅程。

**最小触发例：** 把model/thinking/effort/speed做成视觉chip但无group/checked语义，或对Enter采用面板级统一提交，用户在筛选/展开details时可能触发Apply；原focus+Space检查不会发现。这里是新设计必须避免的可达实现风险，不宣称尚未实现的代码已有此bug。

**验收补充：** 每个单选facet有独立可访问组名和可读当前值，优先native radio/select（若用现有控件则保其真实键盘契约），不要把富Dialog伪装ARIA menu。Arrow/Space只改变局部筛选/候选，零匹配仍不更改C；Tab/Shift+Tab可达清筛选、候选、Apply、Cancel及details。Enter仅在聚焦的Apply/明确同义按钮激活条件提交；明示omit也不能绕过既有规则。至少一条只用实际Tab/Arrow/Space/Enter完成完整组合并检查onChange前0/Apply后1、A/B不变；分别读出thinking关闭与effort不请求，不能把二者或“不附加”混为同一选项。<=32是当前profile的tuple上限，不把多profile flatMap列表当快速控件输入。

## 3. 异步失效后的焦点位置需要明确验收，不能只验证回调已撤销

**确切源证据：** `ExecutionProfilePicker.tsx:19–29`仅普通关闭或details action切换；`:130–135`按完整tuple key生成/移除控件，`:120–122`错误/不可选/缺失原因呈现。`message-settings.browser.ts:101–106`确认checked/disabled但未在focused candidate遭refresh/cap变化时断言焦点；`:85,109–110`只验证正常可用trigger与主动导航目标。

**最小触发例：** 焦点在候选/分面选项时目录刷新删除其tuple，或者CAS返回stale使Apply禁用；即使0写的ownership保证成立，焦点可能留在移除/不可用节点或跳到页面，用户仍不知道下一可用动作。若旧pane已经hidden，普通close也不能抢回旧trigger；这是DOM焦点验收缺口，具体浏览器行为尚未运行。

**验收补充：** tuple/权限失效保C与原因，同时让现焦点保持在仍connected/可见的同Dialog合法控件；若原聚焦节点将消失，移到稳定的有名标题/原因（可程序聚焦）或明确恢复动作，不能自动选择新tuple。正常Cancel/Escape回原可用trigger；details主动导航保宿主目标且不随后抢回；pane隐藏/卸载/撤权时不把焦点拉回旧界面。覆盖focused candidate→目录删项及focused Apply→stale两种变化，并验证重新打开后的初始焦点不是上次失效DOM。per-opening liveness仍按原方案负责阻旧callback，本项只补物理焦点与可读反馈。

## 归属、方法与限制

三项均归既有 **WPF-MATURE-02-11**（MATURE02权威plan:32）/已批准quick-controls后继；管理plan:127、394已有范围与ownership验收，原leaf plan:26、30–38保控件/宿主边界。只建议补该TODO的可验收条件，不新增层级/任务、public slot或权限接口，不预领任何路径。

方法：按find-skills本地优先复用assistant-ui architecture“props受控UI / 单一宿主事实源”，clean-code检查语义命名、窄接口、错误/焦点生命周期；web-design-guidelines已读但其fresh远端规则流程未执行，**不声称完成该外部规范审计**。没有外部安装或API/运行；未实际使用读屏器/浏览器/触屏，不给屏幕阅读器互操作PASS、焦点时序实测或视觉结论。正式源目标与允许的验证预算由原owner/root/manager后续固定。
