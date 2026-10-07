# 共享浮层与消息设置视觉后继（只读设计输入）

时间：2026-10-07。归属原 MATURE01-02/04、REQ22/23，并关联消息设置原 TODO11；不是新 task/claim，不修改项目，不阻挡已经通过的 MSG 两条页面旅程或最小 Web 发布。root 使用本地 frontend-design、brainstorming、find-skills 与 clean-code。分类为原界面内有界视觉设计研究，用户已明确授权持续研究优化和写入原计划；无新的批准请求、安装或产品执行。

## 证据与问题

已目视本次真实 390×844 浅深 PNG，均完整显示应用/取消与长模型名末尾差异。GO 的原视觉反馈：窄屏浮窗直角硬边、遮罩过重、四筛选加列表过于表单化、文案偏实现语义；需要共享层次处理而不是局部 picker 补丁。root 补充滚动条压靠速度下拉右侧。截图是故意 180 字同前缀模型名压力输入；不能推断真实目录异常，也不能由该截面宣布整体 Arc/Codex 美学完成。

固定源证明：DialogContent 使用 sm:rounded-lg，因此窄屏没有这条圆角；Overlay 固定 bg-black/80；同一共享包装已经提供 Radix 模态/标题/焦点语义。全局已有 flow-radius-pane、flow-shadow-overlay 和 popover/foreground 等语义 token；ep-settings-body 是 .15rem padding 的滚动容器。Picker 当前四个筛选仅筛现有完整合法组合，pending 选择与 applied 当前草稿不同；不能为减少表单感而把筛选变成四个可任意拼接的执行设置。

## 推荐方向与取舍

优先改共享 Dialog 表现，再用消息设置验证信息层级。保留 Radix/官方 Thread 的现有行为，建立统一的浮层边界、圆角、阴影、遮罩和标题/内容/底部操作关系；关联主题 token，避免每个功能复制一套 CSS。现有插件的颜色白名单只接已知 color tokens，不支持任意 radius/shadow/filter 值；若以后需要公开新主题能力，须显式给出受控 schema/白名单，而非让插件注入任意样式。本片可以优先消费现有语义 token，宿主尺寸与间距保持私有。

备选是窄屏改为底部抽屉：更贴合手机，但引入新的断点形态、焦点和滚动行为，需要额外实际验收；本轮不优先。仅给 picker 加圆角和淡遮罩最小，但会留下其它弹窗不一致，不能满足 GO 的共享视觉目标。

视觉约束：沿用户给定 Arc/Codex 的紧凑、安静工作区，不新增装饰色、英雄标题或卡片套卡片。字体保持现有系统 sans，中文同一字级节奏，弹窗标题约16px、主体14px、辅助12–13px，主要操作不缩成难点按的小字。拟验证的六个基色为纸白 #FFFFFF、侧栏灰 #ECEEED、深底 #222426、浅字 #F8FAFC、深字 #202124、次字 #6B7280；这是设计候选，不宣称当前精确计算色或对比测试通过。颜色最终仍映射现有语义 token，浅深遮罩分别调校，优先采用已定义的共享阴影而不是任意新增多个阴影。

信息顺序从用户任务出发：

    下一条消息设置                       关闭
    当前：模型 / 思考 / 速度
    [模型筛选]                  [更多筛选 ▸]
    可用设置
      ○ 模型名   思考 · 力度 · 速度
      ○ 不单独设置
    待应用：所选设置
    [配置详情 ▸]
    取消                               应用

这是候选结构，不能机械改现断言或抢当前 owner。把四筛选默认展开改为渐进披露前，应验证正常目录最常用路径、四分面依然可键盘操作及筛后失效的焦点落点；每个实际选项继续代表中心已声明完整组合，不能自动选中或把第一个结果当当前值。默认收起高级标识，只有实际错误/失效需即时提示。当前与待应用保持清楚，Apply/Cancel 仍唯一提交/舍弃边界，关闭不是应用。

用户文案候选：“下一条消息设置”“可用设置”“不单独设置”“应用”“取消”。“不单独设置”仅映射 omit，不能写成“恢复默认”“沿用上一条”或承诺某一实际模型；不把请求字段、profile digest、宿主授权词汇放在主操作说明。细节展开里保留准确请求/实际结果区别，目录失效仍保原草稿。已发送和排队消息不变的事实保留一行即可。

## 可访问性与滚动细化

继续由现有 Radix Dialog 管理 modal、Escape、标题及焦点；调整视觉不应重写 portal 或 focus trap。长内容初始焦点必须让标题/说明仍可见，关闭后回到仍然有效的原触发点；原失效 generation/CAS 防护保留。[Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) 和 [WAI Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) 支持这些约束；这里是应用于既有界面的设计建议，不是新增实测结论。

滚动条处理不能只加 scrollbar-gutter:stable 就宣布修好：overlay 滚动条不占 gutter，仍可覆盖内容；应有足够 inline-end 内部间距并分别验证 overlay/classic 两模式。固定底部操作和完整名称换行保留，不能靠 overflow:hidden 隐藏被挡控件。[MDN scrollbar-gutter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter) 明确区分这两种模式。

## 后继实施与验收边界

经理在当前发布之后按唯一 claim 调度，候选共享路径 Dialog、assistant-ui.css，消息设置消费者 Picker/CSS 与对应现有行为/browser 测试；这些并非已领取范围，MSG 与共享主题其它 writer 必须先 fresh 核权交接。只在实际设计需要时扩到其它消费者，不开通用 overlay 框架或第二主题 store。原 plan/status/review 是唯一事实源。

下一自然视觉片验收：正常可读目录的默认收起态，长同前缀压力态，浅/深/opaque 主题，桌面全页与390窄屏（含软键盘/短视口的可达性），Apply/Cancel/Escape/Tab和返回焦点、目录失效、reduced-motion、同一共享 Dialog 的至少另一个真实消费者。保持原材料、Recovery、Queue、ACK冻结语义与性能边界；只跑受影响检查，不追 metadata SHA 重跑绿色业务矩阵。不凭静态截图推断数值对比度、屏幕阅读器或性能收益。

clean-code 复核：消费一个已有共享包装和语义主题系统、保留原合法组合 authority/Apply CAS；不新布局 engine、不复制筛选 store。当前无实施修复，以上均为已记录的后继，不计本次功能失败或新发布阻塞。
