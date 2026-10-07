# Quick b3：下一步因果区分方案（只读、未执行）

结论：先用同一实际 Chrome 的普通原生 select 对照，检验明确的“打开—移动—提交”键盘路径；现在不足以修 Picker 或认定焦点丢失。只有对照证明相同原生操作在实际控件上下文失败，才进入产品修复。不要为让已有测试变绿直接替换控件。

固定输入：Quick HEAD `e42bb0299990ebedf2b49a02634575c25bbfeb6b`，clean；四产品源逐字等于 `fe6ece131c489c79cf531a184e4cf51209f9c4a0`。全部完整路径、字节/hash、固定 Git blob 比对见 `sources.json`。本段未跑任何 subject/runtime，也未新建 b4、gate 或更新预算。原实际失败与 root c65f 审查不改：累计 30625 ms，剩 29375 ms（含 15000 ms 清理）；0/6 组、0 PNG。

## 事实与不能推出的结论

1. 固定 browser.ts:89–94 聚焦模型 select，然后连续 `keyboard.press("ArrowDown")`、`keyboard.press("Enter")`，等待 value 为长模型。b3 的 10 条记录是 5 个事件及其 5 个 rAF 采样；所有 rAF 均在 Enter 后。target 始终在采样时 connected/enabled/focused，键事件 trusted、defaultPrevented=false，value 空/index0，3 个 option 均存在且启用，没有 input/change/focusout。该证据不支持“焦点丢了”，也没有观察到可归因于 React 的选值再回退。它没有记录原生弹出菜单是否开启/内部高亮了谁；document 焦点和原生菜单焦点不是同一观察面。
2. Picker.tsx:298–299 是真实受控原生 `<select>`，只通过 onChange 调用 private filter；244–247 仅更新局部筛选并清除 pending，不直接提交 C。266–274 的 native fieldset 管 disabled；216–229 的恢复焦点只在已跟踪元素脱离/disabled 时触发。255–257 只有焦点记录与关闭回焦，没有吞 ArrowDown/Enter 的处理。Dialog 包装32–52转交 Radix；Radix Dialog 有正常 focus trap，这本身不是此次故障证据。
3. 已安装 Playwright-core 1.63.0 的 coreBundle.js:21388–21415，press 依次等待 down/up；只有显式 delay 才等待延迟。Chromium RawKeyboardImpl:35771–35829 发送 CDP Input.dispatchKeyEvent，Mac 还带 editing commands。命令返回不等于原生 popup 已经呈现/移动完成。没有证据表明此调用走了 selectOption 或值注入。
4. b3 supervisor.py:229–244 实际启用 `--headless=new`、独立 profile/cache/临时目录、native Chrome sibling；未禁 Chrome 原生 sandbox。worker.mjs:117–130 通过 CDP 连接，建立新 context（1280×720/reduced-motion），调用真实 fixture/browser。实际 Chrome 版本沿封存证据为154.0.8037.98；本次未启动或查询版本。无“可见窗口人工键盘已复现”证据。
5. Root 提供的历史 Chromium commit `6cc8efac3b49137d8f9b09356f47fc377acbdac6` 的 Mac PopsMenuByArrowKeys 分支，只支持“ArrowDown 可能只开菜单”的机制假设。它不是本机154版本对应源或此次因果证明。本段没有重复429请求，也没有将历史源码当本机实证。

## 推荐的最小诊断（未来需合法执行入口；当前未实现）

只检查模型 facet；不立刻重跑整个6组。保留原场景和全部旧失败，不改产品，也不把诊断算原验收通过。

- 同一 Chrome 二进制、启动参数、Playwright、context 下，使用独立 owned loopback 控制页：一个普通 native select，复制相同三个 option 的原始 value/顺序/初始空值，无 React/Radix/业务事件处理。不能把它放在已开 modal 背景，因为 focus trap 会引入新变量。控制页只是诊断对照，不代替真实 fixture。
- 路径 A：在该控制页复现原 `ArrowDown → Enter`。路径 B：另一份全新相同控制文档上，预先声明 `Space → ArrowDown → Enter`，分别表达打开/移动/提交。这条路径是待验证假设，不宣称已知本 Chrome 必然支持；不能失败后继续猜键或循环加 ArrowDown。
- 每个 press 完成后先取得只读 DOM/event 快照，并等待有界的一次 animation-frame 观察回执，再发下一键。记录 value/index/options、activeElement、isTrusted/defaultPrevented、input/change/focus/connected/disabled。rAF 仅是文档观察边界，不能冒原生 popup ready 信号。若支持，可加 `:open` 的三态观察（true/false/unsupported）；false/unsupported 不单独判菜单未开。所有等待受同一绝对截止约束，无固定 sleep、延时盲试、selectOption、赋值或合成 change。
- 仅当控制页 B 实际出现所期望的 native input/change 与目标值，才在新打开的真实 Quick modal 上执行同一 B 一次；真实 HTTP catalog、C/A/B 和 commits=0 保持。记录每步，不扩到其他facet。若控制页 B 自己仍无选值，停止为 INCONCLUSIVE，不继续用 Picker 调参试错。

因果读法：控制页 A 失败/B 成功且实际 B 成功，支持原测试把开菜单当移动的序列假设；只能据此再审测试适配，不证明历史 Chromium 分支就是根因。控制页 B 成功但实际 B 失败，才收窄到真实 modal/controlled 上下文；若焦点移动/disabled/disconnect，则查对应生命周期；若有 input/change 后值回退，则查控制值/authority reconcile。两者均无 input/change 且焦点稳定，仍是 native/headless/CDP 路径未分离，不足以归产品缺陷。任何观察器失败、截断、菜单状态不可见都要保留为限制，不能用空 trace 当通过。

这是因果诊断提案，不是新预算授权。现剩工作约14375 ms且还要启动/清理；若下一固定准备证明容纳不了以上短对照，就报告预算不足，不能挤占清理或承诺能完成6组。

## 仅在证实控件可用性问题后的 Radix Select 小接口

已有 apps/web/package.json 声明 radix-ui 1.7.0；已安装 umbrella 的 package.json:74 依赖 @radix-ui/react-select 2.3.8，dist/index.mjs:25/59 暴露 Select。对应实际 Select 源40–41/227–235有独立开菜单键，507–524处理列表方向键，906–918提交选项；箭头焦点移动自身也异步安排，换它不等于无需正确同步测试。

最小可保留 private QuickFacet 的 label/value/options/onChange 接口，加明确 disabled 输入；实现为受控 Select.Root/Trigger/Content/Item，onValueChange仍只改局部 filter，完整 tuple 选择、Explicit Apply、opening liveness、host CAS不动。可使用已声明 umbrella export，不能自行新增包或未领取的新 wrapper 路径。

必须付出的边界检查：custom trigger/portal 不可依赖 native fieldset 自动禁用，要显式传 disabled并在权限/ownership失效时关掉弹出层；label关联、Dialog内portal层级、Escape分层、合法回焦、刷新删除候选均需验。空“全部”与真实值必须无碰撞映射/显示，不生成默认tuple或自动提交。180字符模型/390px列表与触发器需有界换行。现在六源别名/pins没有证明 Select新增运行依赖闭包，后继须精确绑定现有第三方readonly入口；安装不在本任务授权内。

原 `toHaveValue` 面向native select；若有正当产品换控件，测试可改为实际combobox/listbox/option的语义观察，但必须保真实键盘、目标选择、C不变/一次Apply、A/B冻结及其余场景，不得以删值断言掩盖原问题。此方案增加portal/focus/transitive依赖成本，当前不推荐先实施。

## 方法及边界

复用本地 find-skills 已安装发现结果；clean-code 将动作与被动观察分离、保留原错误并避免无界重试；codebase-design 保留 QuickFacet 私有接口和单一 host authority；webapp-testing 用真实 locator/事件与同浏览器对照；brainstorming 按已授权的只读 spike 比较诊断和条件方案。技能文件hash见 sources.json，未重装。只读Git/本地源码和封存raw；仅新增本报告及pins，不改任何项目/packet、无新检查或服务查询。
