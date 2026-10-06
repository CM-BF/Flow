# RECOVERY01 draft 接线只读核验

固定源：`cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd`。以下项目行号均由 `git show <固定SHA>:<path>` 读取，不是 moving checkout。实际已安装官方版本为 React 0.15.23 / core 0.3.22，与该 SHA 的 lock 一致；完整绝对库路径、14 项项目 blob/SHA256、6 项库文件 SHA256 见 `source-manifest.json`。本报告只有源码核验及推论：0 产品测试、浏览器、服务、PG、provider，项目零写入。仅写本 `/tmp` 目录；不复审 panels moving 实现。复用已读本地 find-skills / assistant-ui / codebase-design / clean-code 方法，聚焦状态权威、同步订阅、所有权转移和释放；不安装技能。本段与请求 JSON 容量报告独立。

## 现有权威与最窄接缝

| 材料 | 现有权威、更新/订阅点 | 恢复限制 |
| --- | --- | --- |
| 正文 | `apps/web/src/conversations/ConversationThread.tsx:176–181`：通过官方 `runtime.thread.composer.setText/getState/subscribe` 恢复和镜像到 App drafts Map。`apps/web/src/TaskThread.tsx:56–60` 的 DraftState 只有 text/harness/scenario。 | Map 不是完整草稿。沿公开 composer setter/subscriber；不要 DOM textarea watcher、第二 runtime 或将异步 React effect 当唯一捕获点。 |
| 投递方式 | `ConversationThread.tsx:82` 的局部 `intent` state，`158–175` 同步 submit 捕获。 | 当前没有外部存取/订阅；仅恢复文本会把曾选 Queue 的草稿恢复成默认 Follow-up。应由该现有选择状态明确接收恢复值，不能从历史请求推断用户下一稿意图。 |
| profile/project | `apps/web/src/App.tsx:370,530–546,955–956`：profileSelections 按稳定 view.key；`plugin-integration/knowledge.tsx:33–43,62–68`：项目选择与订阅由 Knowledge binding 持有。 | `ConversationThread.tsx:86–87`、knowledge:43 的已创建会话/unknown CREATE 冻结 creation 是锁定权威；不可用恢复的未发送选择改写 pin/project。项目选择要走已授权、已加载项目约束。 |
| 知识引用 | `knowledge.tsx:69–83` capture 保留 controller + selected 数组身份 token；consume 只消费相同代际。`120–123` UI 单独订阅 controller。 | 只订阅 Knowledge binding 不足以观察所有 selected 变化；需订阅当前 controller。`conversation-context/controller.ts:170–180` select 要求已搜索/已选择的合法成员；不存在通用导入接口。不能 cast 持久引用进私有 map，也不能自动替换为最新版本。 |
| 附件草稿/旧提交 | `plugin-integration/attachments.tsx:48–59,103–111` 的稳定 binding/Input 与订阅；`194–224` capture/assert/handoff；`232–235` protection。 | 官方 chip 只是显示 ID，实际 refs 在 Input。`attachments/adapter.ts:30–34` 必须由真实 ready Input item 生成 chip。恢复 chip 但不恢复合法 Input 成员会造成可见却不能提交。已冻结旧提交必须与下一稿分开。 |
| Steering 新稿 | `conversation-steering/SteeringControl.tsx:18,37` 局部 text state/revision；onChange 同步递增再 setDraft；`22` 只在原 revision 未变且本地提交成功时清稿。 | `control.subscribe` 只公开 controller 快照，不含未发送文本；当前 props 只有 control（第6行）。完整恢复需要在这个现有状态入口增加明确受控/订阅与恢复 seam，不能靠订阅 receipt 推导文字或读 DOM。 |
| view 生命周期 | App:409–437,575–591 持有稳定 view.key 并迁移 draft route alias；session:166–194 按 stable viewKey 保 binding。 | namespace/connection、stable view key、conversation link 与动态 route viewId 要分别记录；不能只用会变的 route ID、当前 focused task 或相同 URL 作为恢复授权。 |

官方同步依据：core `base-composer-runtime-core.ts:119–125` 的 setText 在值变化时同步通知；react `ComposerInput.tsx:371–385,403–412` 的用户输入和 IME compositionEnd 都调用公开 setText（flushTapSync）。恢复应先确定加载/代际规则再启写，不能让初始化空稿通知覆盖旧记录，也不能用迟到持久读覆盖用户已开始的新编辑。原文、换行与 IME 内容不 trim/NFC。

## 真实发送边界：不能把 empty composer 当持久 handoff

1. core `base-composer-runtime-core.ts:316–357` 先快照 text/attachments/options，随后清空、同步 notify，再 dispatch；全 CompleteAttachment 快路径没有 submission，尚不能以 inTransit/submission 证明所有权。`external-store-thread-runtime-core.ts:730–743` 可先 await abort 客户端工具，再读取当前 onNew。`runtime/api/composer-runtime.ts:345–348` 公开 send 返回 void，不能 await 它当回执。
2. 当前 Thread 已有正确业务切点：`pending.current` 在 `169–173` 同步保存 intent/text/creation/knowledge/material；`100–124` 用它建立真实 Outbox/Queue receipt，并比较新旧 ID，只有真实新 receipt 接手，才同栈 attachment.handoff + knowledge.consume，然后 `127` 才 await 网络。持久 command 接手应在这条真实边界上落实，网络 ACK 不负责清下一稿；完整 draft 恢复也不能只观察 composer 空通知就删旧稿。
3. `130–143` 的无 handoff 错误仅在当前 composer 仍完全空时恢复原文字/chips；如果用户已有新稿，不把旧内容 prepend 进去。`base-composer...:564–583` 的一般 MessageNotSentError 回稿会前插旧内容，因此恢复不得再重复触发同一回稿或用旧网络错误覆盖新稿。
4. adapter prepare reject (`397–400,498–528`) 和 cancelSubmission (`551–556`) 不调用 onNew；仅在 onNew.finally 结束 pending 会漏这些终结。当前 private attachment binding `165–192` 已订阅官方状态完成 failed/returned-ID 识别；不要用恢复逻辑绕开它。`260–285` 的 reset 会取消上传/改变 generation，不是无害的草稿 hydrate。
5. capture 是内存一次性身份：`attachments/controller.ts:247–264` 通过 WeakMap 保存 epoch、原 items、used，并于真实 receipt 接手后 consume。不能序列化再反序列化旧 capture 当可用 token；持久旧 command 保存冻结请求，未发送草稿重新取得合法 ready 元数据后才产生新本地 capture。visibility/online/auth 变化会让原 capture 失效，不得降级丢附件发纯文。

## split / merge / close / reconnect 的现状与风险

- `workspace-state.ts:27–51` split 将 active tab 移到新 group，merge 合回第一 group；App:940–969 的 Thread 在每个 group 子树内，view.key 仅在该父节点内稳定。因此移动 group 可重挂 Thread/runtime：文本依赖 drafts Map 恢复、session 绑定保材料，但局部 intent 回默认是明确源码风险；这次没有运行复现。
- 普通隐藏是 App:946 native hidden，不是 chat React.Activity；不应假定 effect cleanup 停读。实际 visible 由 App:951 传实际 pane/page 状态，两分栏都可以 true，不以 focused 判唯一授权。workspace 的 Activity 在977行，与 chat 分开。
- App:530–574 关闭会移除 tab/卸载 Thread、清读缓存；有 protection 时保留 view/session。session:197–213 检查 attachment、知识/项目和 steering entry；放行 release 才 dispose。重开应复用同一稳定 binding；当前 Thread:149–153 只重加 ready item 且排除 held 老提交 ID，恢复不可把老提交材料塞进下一稿。
- `plugin-integration/steering.tsx:200–212` 的 visited surface 放在 groups 外（App:703），hide 仅 hidden，所以同页 split/merge 能保局部 steering text；session.getViewProtection 以 entry 存在保护，但不等于能持久保存其 text。真实 reload/connection replacement 会重新构造空 text。
- App:696–700,766 的 beforeunload/change-connection 提示只覆盖 steering 风险收据和 attachment protection；不是纯文字/知识/profile/未发送 steering 文本的全面持久保护。不能把现有内存 retained view 称浏览器重启恢复。
- App:1065–1099 连接使用新 UUID/key，session:303–319 先同步 closed/abort 再 dispose。重新授权的 namespace + project/view/conversation 校验先于任何旧 refs 查询/写请求；相同 URL 或新 token 不自动承接旧授权。storage 错误要可见、保原记录且不阻纯文字；不得因恢复失败 erase unknown 身份。

## 必要行为验收（候选；本研究没有执行）

1. **同步草稿与重挂载**：IME/换行/程序化 setText、Queue intent、未锁 profile/project 和有序 refs；split→merge→close-retain→reopen 完整保持，页面内切 route draft→conversation 不换 stable binding。不得自动 send/query 正文，也不得把默认空快照回写覆盖待恢复记录。
2. **旧提交与 next-draft**：Complete 与 requires-action 两种官方路径，click 时原材料/intent 冻结；清空通知到实际 receipt 前失败仍保原稿/refs；建立真实 receipt 后新稿独立，迟到 ACK/错误不清新稿；同 citation/attachment remove 后重选属新代际。只以真实新 receipt 同栈接手消费，未知原 key/body 不重新生成。
3. **prepare 终结**：prepare reject/cancel、隐藏/撤权、混合 complete+pending；没有 onNew 的路径也解除 preparing，原 chip 与 Input 一致，直接 remove 后不幽灵复活，下一稿可发。恢复不能调用 reset 误删上传/持有状态。
4. **完整重启恢复**：合法绑定下恢复 draft text/ref 与独立 unknown command，refs 初始未验证不伪造 ready；项目/pin CREATE unknown 不可变，授权不符零请求，storage 拒绝/坏 raw 保留且纯文可用。上传 journal 的 metadata 恢复不等于 ready selected 草稿自动恢复。
5. **Steering 独立新稿**：正在提交 A 后输入 B；A 迟到成功/失败不清 B；隐藏/分栏仍保 B，真实 reload 从其专属 draft authority 恢复，不与普通 Send/Queue 合并。已结束 attempt 不因恢复文字自动发新 command。

## 核验哈希与范围

关键 SHA256：
- ConversationThread.tsx `e1e98f00c2450224e2ce619c8a8d8a9a03b844361bee627df25b07b89cfe004c`
- App.tsx `8fb5b1381ea3a65d52cc4bfc76341ecb9cec2c735c13258805c148b6922a819d`
- private attachments.tsx `ecec5a76bb0c0e89c4ac3b5cd4f4d56345299d737e15ca86088f244228fcd56b`
- SteeringControl.tsx `ad001378fe9528e8e5741c94e64e840ab09dc6236289a0eb723922ed674e15e9`
- installed core base composer `6de137d5c36d9b4278b2363e5e797afddd3ebf9520060783c67cdc26c1831719`

本段 clean-code 只读复核：保持现有多个真实状态持有者的窄接缝，不引入第二 runtime/权限或 DOM 镜像 registry；明确 command/draft/capture 三种生命周期，不把订阅通知等同提交成功。没有实现、没有修改 public limits、没有证明未实现 journal 的完整恢复能力或容量。
