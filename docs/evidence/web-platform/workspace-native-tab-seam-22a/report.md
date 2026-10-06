# 固定22a：右侧内置tab逐项动作接缝

唯一结论：**Task workspace 内置 Files / Terminal / detail tab 的逐项动作位置，尤其未激活产物tab，仍没有实际P01渲染接缝。** 这不同于已有外层 Extension panels 的workspace.tabs贡献，也不同于当前产物详情的artifact.actions。只把这一点归入原MATURE05-03；不新建task/slot/contract/registry或实施方案。

基线：22a0806bc2465e11096949618113833f31766b19。管理提供main/origin/远程同SHA；本研究只git show该对象，未fetch/跟随HEAD。9个必要源码完整blob hash在audit.json，仅审下列相关范围；未读取或修改Recovery分支。

## 查重复用与边界

已读指定五个管理入口。plugin-seams.md的workspace.header/tabs/actions是最初一般位置建议（观察2286且dirty，非固定产品结论）；conversation-plugin-coverage-research.md及两Arc JSON已覆盖真实conversation sidebar/tab、Retained chats、稳定view布局及Recovery/连接页。这些不重开研究。research.md:254记载旧I01已补外层workspace.tabs合法button/menu；本报告不把它报成缺失。research.md:180等PH-R4是A/B/A原workspace状态丢失的历史审查，也不复测或重复报缺陷。

在上述指定/定向来源中未见“内置右侧每个已有tab旁可贡献动作，非激活tab绑定自身身份”的具体覆盖核验；不宣称全仓没有其他报告。已有最相近入口仍复用plugin-seams.md及原Arc方案，不产生新计划层。WorkspacePanels、builtin workspace module、builtin manifest与旧Arc fixed f3e569db...逐字相同；integration/react与types等整体已变，故本次用22a重核实际接缝而不搬旧行号。

## 已经实现的覆盖（源码事实，未运行）

1. App.tsx:1000–1010将实际工作区projection送入PluginWorkspace。plugin-integration/react.tsx:191–225在外层读取workspace.tabs的panel贡献，持有selected/visited并渲染PluginView；219另有真正AppSlot承接同slot的button/menu。不是只有data属性。
2. plugins/builtins.ts:7–49把整个Task workspace作为flow.workspace.panel贡献，拥有ui.layout/workspace.read/reference.read；builtins/workspace.tsx的WorkspaceAdapter把显示任务与workspace context匹配后渲染原WorkspacePanels。插件化覆盖当前是整块面板，不表示内层每个widget/位置均可贡献。
3. plugin-integration/react.tsx:253–256为workspace.header、workspace.actions传入实际AppSlot；artifact.actions仅以当前activeTab对应reference构造reference context。WorkspacePanels.tsx:136和170分别渲染共享chrome与当前详情动作。
4. plugins/react.tsx:17–68才是真正声明式button/menu渲染及host.execute入口。DOM上的data-extension-slot不自行挂载贡献，不应靠扫描DOM注入绕开host。

## 一个精确剩余接缝

WorkspacePanels.tsx:51–58固定组装files、terminal与已开detail数组；138内层tablist虽然标data-extension-slot=workspace.tabs，139–156每项只渲染native tab及detail硬编码Close按钮，**没有逐项ExtensionSlot、贡献renderer或回调型actions口**。WorkspaceChromeContext:10也只有header/actions/artifact三个共享ReactNode。

外层react.tsx:219接收的是237当前activeTab的workspace context，不是被指向的某个未激活tab；253–256同样只提供当前上下文。因此用户希望在未激活产物B的标题旁加一个受权动作时，现有外层工具区不能被称为该位置已经可插拔。新增另一个workspace panel或替换整块builtin虽能另画UI，但不是在原有tab上贡献按钮，也不能用来声称原要求已完成。

这里不判定native关闭按钮有产品bug，也不要求所有像素成为公共slot。缺口是一个实际宿主位置尚无声明式接入；P01仍应为唯一registry和dispatch authority，原WorkspacePanels保有openDetails/focus/layout，不能让插件维护第二tab列表。

## 现API足够的部分与不能偷换的权限

- types.ts:21–30已有workspace(taskId,tabId)和reference(taskId,referenceId)，85–92已有flow.workspace.open及flow.reference.load；validation.ts:21–24、117–145已界定slot/context。普通“定位这个已有tab”样例不需要创造公开后台DTO或复制HTTP；已有ui.layout命令可用。
- session.ts:83–102在执行前核当前session/任务，detail导航再assertReference；283–301提供closed/abort和reference membership检查。现workspace context的validContext并不独立证明某个tab当前确实仍在openDetails，所以未来宿主必须绑定真实tab row/lifetime，不能只把任意tabId写进context或借全局activeTab。不能把这项设计验收说成已存在的全部权限保证。
- 原closeDetail:110–116是组件私有布局动作；公共flow.workspace.close关闭整个工作区。两者不可混淆，不为本只读研究新增关闭单tab公有命令。现原生Close与Delete键继续保留，插件动作不能替它处理未知receipt或cancel后台任务。
- future seam的具体命名/是否复用现slot须原P01 owner协调；本报告不扩公共类型，不规定新增slot，更不建立第二host/动态DOM注入器。先复用已有窄context/command与单一私有布局owner即可界定验收。

## 归属与可验收条件（候选，全部未运行）

主归属管理plans/wpf-mature-05-workspace/plan.md:27的WPF-MATURE-05-03（组合pane菜单复用P01、sample贡献/禁用/跨连接身份）；04:28是文件/产物与窄屏内容范围，05:29是实际App验证要求。REQ22–23只是原用户可插拔要求追溯，不形成第三层或新TODO ID。

1. 真实Task workspace已有A/B两个产物tab，A激活时sample贡献可在B自身动作位被键盘发现，明确收到原task+B身份；简单定位B经现command到B，不假装全局A就是目标，也不更改核心来注册每一个sample按钮。
2. 显示动作/展开动作菜单本身零正文GET；只有显式允许的读取动作触发原reference.load。body错误、离线/未知与原detail重试仍可见，不移走或吞掉必要内置动作。
3. disable/unload/revoke与换连接撤该贡献/旧callback，原Files/Terminal/detail标签及原选择/滚动状态保持；旧B删除或membership变化后保存的动作不可作用于新任务/同名产物。无隐式POST/cancel/复制历史。
4. 390浅深及键盘核tab方向focus、Enter激活、action焦点与关闭后回交，不向role=tab内嵌button，不打破原Delete/相邻tab行为。原外层扩展tab与内层tab名字/区域可区分，避免把外层通过当逐项通过。

上述是source推导的覆盖缺口和候选验收，不是动态失败复现/APPROVED。0产品import/运行/tests/HTTP/PG/Chrome/free/claim/项目写入；仅本/tmp报告与hash。复用既有local技能方法：明确宿主与插件责任、身份/生命周期、错误所有权，未新建框架或泛覆盖清单。
