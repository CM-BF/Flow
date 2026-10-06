# TUI01A — cross-task review receipt

Conclusion：**CHANGES_REQUESTED**；2 P2 / 0 P1。Fixed implementation：`9e5588d4d6b24234bb829c23269e6e72caca44af`。Reviewers：Mika / gpt-6-astra 与 status_read / gpt-6-astra；只读独审时间：2026-10-06 09:39:58 UTC。

本文件仅保存Mika转交的跨task依赖review收据，不复制TUI进度，不构成第二status，不修改TUI代码。修复交原TUI owner；02不接管其scope。

## P2-A：保存失败使退出清理提前拒绝

`controller.ts:51` 的save位于try外。save pending时退出，`dispose:128` 等待activeMutation；之后save因EIO/ENOSPC拒绝，使memoized dispose也拒绝。`main.tsx:24` 的stop().then没有catch，`main.tsx:34` 的finally又先await dispose，拒绝会跳过后续unmount/store.close。连接/锁可能遗留，下一次启动因O_EXCL失败。

TUI owner应等待mutation settled，让资源清理位于独立finally，并处理stop拒绝。需要deferred save rejection与concurrent dispose/store重开的行为回归；既有成功退出检查不能替代这条失败路径。

## P2-B：未知ACK提前清除唯一恢复意图

`controller.ts:55–61` 的create收到HTTP200且可解析为 `{}` 时，在必需shape校验前clear唯一intent。后续selection失败进入catch却宣称已保存；recover因intent=null丢失原key，无法按原请求重放。send也仅检查conversation.id，未充分核对已接受turn与提交请求的对应关系。

TUI owner须在clear前校验必需ACK形状、identity及已接受turn对应关系；未知ACK保留原key/body并返回UNKNOWN。需要真实HTTP200未知shape后recover仍使用同key/body的回归，不能以重新生成请求替代恢复。

## 固定证据与限制

Manifest绑定17 source / 23 raw / 6 readonly；全部SHA与bytes满足target Git=现场worktree。最新metadata仅收到缩写 `334448c`，现场clean；未猜测或展开完整SHA。Lead已独立核验41项依赖。

既有17个distinct检查为controller11 + UI/journal/headless4 + HTTP/PG2；最后11项是重叠复跑，不能累加成新增覆盖。另有tsc exit0。这些证据不覆盖以上两处缺陷。Mika未重跑测试；02仅记录审查输入，不执行工程验证。

## 方法

沿用已读find-skills本地发现、clean-code与codebase-design：关注错误传播、单一资源所有权、settled与cleanup边界、请求意图/ACK/恢复状态一致性。clean-code来源固定 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`，不重装。本地 `/Users/citrine/.agents/skills/vercel-react-best-practices/SKILL.md` 仅用于hooks/订阅清理方法，不扩大到无关性能重构，也不替代上述controller/HTTP行为证据。
