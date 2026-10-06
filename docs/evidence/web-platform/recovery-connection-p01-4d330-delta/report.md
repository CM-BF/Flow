# 唯一P01 host上移：2498→4d330差异补充

固定 `4d3303d7e107b400ebe8ecae62b8d843c0d1d4cb`；只读观察 metadata `d3d45bcb58e2b34064abfdbb90b9d56edc6cd0d9` clean。归原REQ22/23、MATURE06-04，不是新task或实现批准。复用 `/tmp/w01-connection-plugin-2498/report.md` 和 `/tmp/recovery-connection-p01-2498-second-opinion/report.md`，不重复十源覆盖。原十源中仅App/session变化，八源（含ConnectionSession及P01公共host/types/renderers）逐blob未变；另读Recovery binding的新增差异。完整固定SHA256在同目录manifest.json。

**结论：旧方向仍成立，不需要新增public slot/认证合同。新增实际迁移约束是保留Recovery的`sync()`与完整Restore lease，不能把host上移理解为重新创建业务session或仅换renderer。** 当前尚未实现外层host，以下为后继接线条件，不是新的运行故障。

| 新差异及固定出处（apps/web/src/） | 私有Interface必须保留的行为 |
|---|---|
| `plugin-integration/session.ts:125–146`；`recovery/binding.tsx:101–135` | Recovery现在构造后和updateActions时统一sync，并订阅host状态。仅已授权、namespace存在且entry为registered时启动；active后的同namespace新generation会重新checkpoint保留稿；disabled/failed不自启。外层借用host仍须把**当前业务actions更新与host转换**送入此单一sync，保留同一RecoveryWorkspace；不能只在新注册回调同步，亦不能以preauth的local-ui权限代替Recovery授权。 |
| `recovery/binding.tsx:140–151,310–369`；`App.tsx:653–715` | 新的`restore(record, lease)`以原view/namespace/generation及完整稿fingerprint绑定。list/refresh后核租约，所有owner先prepare再一次同步apply；恢复中编辑会使旧apply失效，并保留当前稿正常checkpoint。外层按钮必须调用原workspace.open/restore入口，不能直接调用App.restore、仅传record或改成新的global动作绕lease。 |
| `recovery/binding.tsx:140,396–398`；`App.tsx:1247–1274` | 恢复中本身已算protection，flush可阻止替换。单retained tuple仍是原namespace/session/client；guard未通过不得绑定B业务，auth-loss只撤权/隐藏，不dispose旧RecoveryWorkspace或移交它给新client。冲突后同namespace重新认证必须走sync保存新稿；正常CAS可替换同slot，不需双存或隐式fork。 |

其余既有接口没有新增差异，但当前定位明确如下，直接沿旧提案，不新增设计分支：

- **preauth动作/私有form**：`App.tsx:1157–1209`仍是固定JSX，settings.sections仅data标记；Check/Signout/Discard/Connect尚未成为真实贡献。Connect按钮和Enter应请求同一宿主form，token只在该form→现ConnectionSession.connect路径；不放public context/command/lease状态。只读状态与无凭据动作由受信builtin私有闭包消费，旧回调不能提交新form。
- **授权租期**：`App.tsx:1222–1259`的实际ready仍要求retained session对象/namespace与当前connection相同且非selecting，不能只看session.phase。`connection/session.ts:35–64,102–126`字节未变，仍是generation/namespace及logout同步撤权权威；AppPluginSession.id不能替代持久namespace。新外层只转接这些事实，不能续期旧意图或自动POST。
- **registration/主题/导航**：旧第二意见的exact-handle cleanup、同global旧callback、disabled不得被重新注册洗掉、主题owner只在app teardown销毁、旧hidden Workspace不得发布旧task导航等要求仍适用。公共host文件未变；不重报既有研究为新finding。`session.ts:147–175,328–346`仍是session私有publish/授权及最终dispose(host+theme)耦合，借用host需要精确私有适配，不能仅删除最后host.dispose一行。

后继验收只补三条差异时序（本次均未运行）：

1. 唯一host下初次编辑默认checkpoint；activation未完成先撤权时0旧namespace写；同namespace重新认证且entry已active后当前保留稿可checkpoint，用户disabled/failed不被sync重启。
2. Restore等待真实owner refresh时改intent-only/profile-only/有序材料，或关闭对话框再编辑；旧租约不得apply，当前完整新稿正常CAS保存。同view第二Restore拒绝，旧globalcallback不得借B authority。
3. Restore/未持久稿使retained guard失败时，外层Connection仍可操作本地Appearance与明确Connect，但A的session/client/RecoveryWorkspace保留且无业务授权；明确处理后才能交接，迟到旧cleanup不影响新entry/主题。共享host不得产生第二enabled/grants/草稿权威。

方法：复用已读本地find-skills、codebase-design、clean-code，按已有职责与私有接缝对比，未安装。报告只固定源码推导；0产品import/test/HTTP/PG/Chrome/凭据或个人服务访问/空间采样/项目写/claim。原Recovery准备与19源均未变；既有50受控证据不代表这个外层host方案已验证。
