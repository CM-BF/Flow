# QuickControls early snapshot：限定键盘/标签/焦点源审

来源：`/private/tmp/message-settings02-component-early.tsx`，SHA256 `7eb525827e18723d1bdcc7d544145906e95cd0d189a71627d92d51ef53da2e3b`，24,764 B。先验hash再读。作者仍实施；**NOT_FIXED / NOT_RUN**。未读取moving工作树，未审root负责的host CAS/ownership/tuple投影正确性。不作完整feature或源码APPROVED。

## P2 QUICK-FOCUS-RETURN：仅草稿换代也永久抑制合法触发器的关闭回焦

位置：此快照 **209–211、242–244**（结构仍对应`apps/web/src/execution-profiles/ExecutionProfilePicker.tsx`）。

可达触发：用户打开设置Dialog，当前pane继续visible且`editable=true`；宿主从外部更新当前草稿C或更换`draftOwnership`。`session.reconcile()`失效后210行撤销旧编辑、显示“关闭后重新打开”，211行同时把`suppressReturnFocus`设true。用户正常点取消（274行）或按Escape→`changeOpen(false)`（194–205行），不会清该flag；随后243行不问当前trigger是否仍合法就`preventDefault()`，244行没有details action可代接焦点。Dialog内容卸载而正常Radix回焦被阻止，代码未提供仍可见/可编辑的原触发器或其他合法目标。实际浏览器最终focus未运行，本项是确定的控制流问题，不冒动态复现。

最小修复：保留原session即时撤销与pending清理；**将草稿编辑liveness与DOM回焦资格分开**。正常Cancel/Escape关闭时，仅因当前trigger detached/hidden/disabled或界面确实撤权才阻止默认回焦；当前可见、启用的同一trigger不能只因旧draft失效被永久跳过。details显式导航仍由原callback接管，不抢回。可在现Picker文件完成，不需改shared Dialog、App、slot或新增范围。

精准回归建议（仍未运行）：同一可见pane打开→宿主换C/token而保持editable→确认旧Apply不能提交→分别Cancel、Escape→原trigger实际focused且重开得到新C；对照editable=false/trigger被移除或隐藏，不抢回旧入口；原details导航目标维持。不要在断言前手工focus trigger，不以移除focus断言过关。

## 本审分工内已见的正确结构

- **标签/状态：235、239–240、248、273**：触发器aria-label已含完整已应用model/thinking/effort/speed，已应用C与待应用Y有独立section名。**249、274**提供单notice status与Apply描述关联。没有将结果称provider已实际采用。
- **原生键盘：253–260、282–283**：四个label包native select；**263–268**仍native radio/同一useId组，**262、274**清除/Apply/Cancel为type=button。没有新增面板级Enter自动提交或ARIA menu冒充Dialog。具体OS select键盘/读屏互操作未验。
- **动态空集：185、231–234、262、271、283**：筛选清pending；没有匹配时保提示和明确清筛选出口，不选第一条/最近tuple；消失的当前facet保“已不可用”option避免控件视觉默退“全部”。**188/274**无合法pending不能Apply。目录失效与用户explicit omit的业务政策归root ownership审，不在此重复审。
- **焦点修复限制：213–216**只检查记录的last-focused是否disconnected/disabled。不能据这段就声称已证明“当前active Dialog受影响节点”精确性；仍需按原addendum做后台更新/其他当前焦点不被抢走的定向验收。本次未发现能仅用所读单文件确定的第二条具体用户路径，故不扩大成另一blocking finding。

## 范围与方法

唯一P2映射原WPF-MATURE-02-11 quick-controls焦点验收。旧270c leaf批准不撤销；这是未固定新实现的早期反馈。复用已读本地find-skills/assistant-ui architecture/clean-code：原生控件、受控宿主、状态命名与焦点生命周期分离；无安装/外部审计。0项目修改、import、Node/test/HTTP/PG/Chrome/服务/进程或空间采样、claim操作；只有/tmp报告。
