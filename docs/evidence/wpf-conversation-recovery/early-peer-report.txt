# RECOVERY01 Foundation 独立只读审查

固定目标：`82d78a9d77f4f51a27dc76fdc413a63dcd88ea72`。审查者 `/root/w01_owner`。以下均为固定源码可确认的模块问题，未执行产品检查或复现程序；App 最终接线尚未完成，不以此作为 finding。完整 fixed blob/SHA256 见 source-manifest.json。

## 新增 findings

### F1 · P2 · 已终结回执被重新解释为 unknown，重新占用业务槽位

固定位置：`apps/web/src/conversations/outbox.ts:48–59`（state 在57强制 unknown）；`apps/web/src/conversations/queue/commands.ts:95–105`；`apps/web/src/conversation-steering/control.ts:126–133`。

三条 restore 都接受合法 `phase:accepted/rejected` 记录，却无条件恢复 unknown。原生产路径明确写这些终态：projection.ts:314/329/349，queue/commands.ts:145/153，steering/control.ts:267/274。通用恢复 UI binding.tsx:160–163 对这些终态也提供 Restore without sending，故不是仅畸形持久数据情形。

可发生场景：成功的 enqueue/pause 或明确拒绝的同槽命令已持久化，重开后显式 Restore。queue.unresolved（112）变 true，execute（115）阻止新命令且 dismiss（123）不移除 unknown；用户被要求重试一条已终结请求。Outbox 同样通过 assertReady（75–78）阻止后续提交，dismiss（139–141）无法解除。Steering 丢掉已保存的 command checkpoint，后续普通 refresh 只更新带 command 的本地 receipt，clearResolved（277–280）也不能清除该 unknown。这里讨论的是 admission 的 accepted/rejected，并非推断运行 task 已完成。

最小修正方向：区分 prepared/dispatching/unknown 与已知终态；终态恢复时校验其最小 checkpoint identity 后保留 admission 事实，必要的当前业务状态走授权 GET，不把它自动改成待 POST。也可以明确拒绝将终态装入 pending 槽并提供终态查看路径；不能 UI 恢复成功却制造 unresolved。

必要局部验收：三 owner 分别恢复 accepted/rejected，0 mutation；原 keys/body/creation/target 保留；不阻塞合法下一槽操作；Steering accepted 仍可按其真实 command ID 观察后续状态。prepared/unknown 仍只能显式原 key 重试。

### F2 · P2 · restored 知识引用显式 resolve 成功后仍永远 unverified

固定位置：`apps/web/src/conversation-context/controller.ts:171–176,193–225`，尤其213只 updateBody、225仍拒绝 freeze。

restore 将每条引用加入 unverified，并明确提示“Search or explicitly read”。readBody（71–77）能确认完整 citation tuple、精确 UTF-8 长度与 currentVersion/isCurrent；成功 resolve（211–213）却不删除对应 unverified。唯一成功验证清除路径在 search 的精确命中（163），remove（190）会丢选择。

可发生场景：恢复旧的合法不可变版本，搜索不返回这个精确 tuple（例如结果是新版本），用户显式展开原引用，授权 resolve 成功且正文可见，但 freeze 仍报 Verify restored knowledge references。再次展开命中 cache（202）也不改变状态。无需伪造数据或失败网络。

最小修正方向：通过 readBody 且当前 generation/授权仍有效的成功 resolve 应核销该 exact tuple 的未验证状态；保留原版本与顺序，不自动升为最新版本。错误响应、错 tuple、过期异步返回不能清除它。

必要局部验收：restore → resolve 原版本成功 → freeze 保原 tuple/顺序；失败/错 tuple 仍拒绝；成功后 cache 展开不会再次阻塞。

### F3 · P2 · 公开合法的241–255字符文件名无法恢复

固定位置：`apps/web/src/attachments/controller.ts:196–205`，199使用 `item.name.length > 240`；公开规则在 `packages/contracts/src/attachments.ts:28–30` 允许255 UTF-16 units 且至多512 UTF-8 bytes。

可发生场景：名为 `'a'.repeat(251) + '.txt'` 的文件，255 ASCII字符/255 UTF-8 bytes，是公开上传/metadata合法值。既存 ready 选择保存后传给 restore，会在读取其合法 metadata 之前抛 Invalid saved attachment identity；整批 map 未发布，用户不能恢复该附件草稿。这与已有长名展示修复不同，是新增恢复边界拒绝合法输入。

最小修正方向：恢复 identity 使用同一个公开 filename validator，随后维持 project/ref/version/digest 的严格校验，不另设更小长度。必要局部验收：合法255 ASCII及合法多字节文件名恢复为待确认；超过公开字节/字符限制仍拒绝；目录验证后保持精确原 ref。

## 已确认的边界（不是新增 finding）

- `freezeMaterialRequest`（receipts.ts:12–23）复用 `freezeContextSelection` / attachmentSelectionSchema，保 omitted 与 [] 形状、顺序、版本/digest，深冻引用；混合材料 project 必须相同，新 creation.projectId 存在时作为显式 project 约束。它不根据 opaque ID 推断授权。
- Outbox 原 creation/两 key/正文、queue 各 command 及 cancel-task.taskId/key、Steering input attempt/revision/bytes/digest 有固定字段重解析；恢复本身不 POST。Steering 的 text digest 在显式 accept（255）重新计算，而不是在 restore 完成；这不应被描述为恢复阶段已验证正文 SHA。
- Journal envelope 验证 namespace/owner 形状并按 exact namespace 列表读取。业务 restore 不是授权入口：Outbox 不自行验证 record.owner，QueueCommands 无 view/project authority；Steering 仅核 task identity。最终宿主必须在调用前核当前 verified namespace、stable view、conversation/project 和 grant；此处未把“最终 App 尚未接线”报为漏洞，也未重复已知跨 namespace 异步问题。
- 原正文不可变不等于仍 ready：附件 restore 继续待授权目录确认；知识应保持冻结版本。accepted 是回执受理状态，不等于 task succeeded。

## 实际范围与方法

仅 git show 固定对象、读取本地 clean-code 方法并应用接口一致性/终态/错误路径审查。没有运行 Vitest、产品 import、filesystem probe、build、PG、浏览器、模型或服务；没有修改项目、依赖、缓存或领取新 scope。

明确排除 root 已知五项：failed handoff transient-empty、真实 CAS 缺失、跨 namespace 异步 capture、RecoveryError 判 rejected 丢原 key retry、logout 未同步 revoke。本报告不复述这些作为新 finding。
