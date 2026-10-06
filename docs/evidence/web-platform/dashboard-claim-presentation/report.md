# D04 → dashboard 领取显示：固定源码核对

固定 main/origin/main：`c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05`。主工作目录 HEAD `af51c621696230fbced12227670f014ca73bd8a1` 不是本报告基线；所有产品内容取上述固定 Git blob。查重输入另固定 DPERF04 `929b706a3bffcc94e31aba32467f88038bd6ea18`，其唯一 status 明确 NOT_INTEGRATED、browser NOT_RUN；不把该分支当 main/部署。

结论：确认一项尚未被 DPERF04 解决的**显示语义差距**：任务曾释放且现在没有占用，与从未领取，会在任务卡/详情中合成同一种空态。它不是原子 take 缺陷；释放历史仍在 ledger 和全局 snapshot 内。该排除行为是原 D04 已明确接受的范围，现按 U08/U12/REQ37 的“用户能分辨已释放”要求记录到原 D04/D01，不新建任务或另报原子互斥回归。`active` 显示“已领取”本身准确；不能仅因没有 paused enum 就报 bug，也不能称该标签证明正在写。

## 1. 从账本到 UI 的实际映射

路径均相对项目，行号属于固定 main。

| 状态/情形 | 权威与投影 | 用户可见结果与边界 |
| --- | --- | --- |
| active writer | `coordination/ledger.mjs:70–76` 创建 active；`aggregate.mjs:81` 保留 | `public/app.js:68` 为“已领取”；工作线显示 lead/worker，摘要卡省略但详情 `174–177` 可见 claimId/version、role、身份、branch/worktree、scope。能辨分配 owner，不能推实时写进程。 |
| 停写、仍持有用于 review/integration | 与上项相同 active，无独立写活动字段；D04 README `19` 明确审查/修复期继续占用 | UI 不区分“现在编辑”与“已停写保留”。这是账本只负责分配的既定契约（README `5`），不是谎报运行；可读唯一 status 的下一步/阻塞，但不能据 dirty、更新时间或 review 推断实时写活动。 |
| handoff_pending | `input.mjs:81–85` 必须 stoppedWriting；`ledger.mjs:35–41,49–52` 原 owner 停写，新 owner 需 version+accept；冲突检查 `20–28` 保留新旧位置 | `app.js:68` writer 显示“交接待接收”，详情 `176` 显示 next owner/worktree 和原 version；并不等于 next 已获写权。旧 UI 未显示 next.branch，DPERF04 已将 next 全字段列为可达（Interface `54`）。 |
| released | `ledger.mjs:42` 明确 released；`readAssignments:88–90` 读取全部 claim，没有 state 过滤 | `aggregate.mjs:81,85` 从 task/unregistered 中删去 released，但 `87` 原样返回全局 assignments。`app.js:67` 空 task.assignments 显示“尚无领取登记；接手前须核对”；`172–178` 详情只有标题、零 claim 行，不呈现历史释放。详见 G1。 |
| 超过 24h 未核对 | `ledger.mjs:88–90` 仅 needsVerification；不释放 | `app.js:68,176` “待核对（仍占用）/禁止抢占”。不能据旧观察 take。 |
| DB 未配置/读取失败 | `ledger.mjs:92–96` unknown + claims[]；`aggregate.mjs:81` 对任务传 null | 卡 `66`、详情 `173` 明确 unknown/禁止新接手，未假装空闲。固定 main 未登记区 `91–100` 因空列表隐藏、未展示全局 assignments.message；此缺口已被 DPERF04 独立观察/保旧标旧方案覆盖，不重复派工。 |
| overlap / 冲突 | `ledger.mjs:59–81` 同一事务+advisory lock，`20–28,73` 拒绝同 task/WT/父子 scope 的 writer 冲突；`input.mjs:49–51` 保守路径键 | 正常提交不会产生两个相冲突的 writer。CLI 失败不是第二份成功 claim；dashboard 不展示被拒请求，也没有从读取结果另算 overlap badge。`matchesSource` 仅 branch/worktree 对登记来源的相等，不是全局无冲突认证。未验证实际 DB，不假设损坏数据形成可达产品故障。review/integration role 另列，不把多条非 writer 当双写。 |

以上均为源码推导；没有访问当前 ledger/API/网页，也没有运行 take/测试。

## 2. G1：释放历史的显示语义差距（已知设计，现需求仍开放）

最小静态触发：注册 task T 的 ledger 只有 `{taskId:T, state:'released', claimId:C, version:2, ...}`，观察 available。`aggregate.mjs:81` 得到 `T.assignments=[]`，而 `snapshot.assignments.claims` 仍含 C；与 T 从无 claim 的输出 UI 相同。打开详情也不会显示 C。历史并未丢失，更不是 release 没生效。

该行为是有意的：`plans/d04-coordination/review.md:28–32` 明确“released 排除”。但它不能满足本轮“分清已释放与未领取”的完整阅读要求。当前 DPERF04 仍 `read-model.mjs:121–125` 同样过滤 released，Interface `54` 也约定保原规则，因此不应将 DPERF04 的 unknown/消失不冒 released 改进误报为已解决 G1。

最小后继验收归原 **D04-03**（只读领取展示）及 **D01-02 / D01-03**（未知/来源及下钻），沿 U08/U12/REQ37，不新建计划：

- “本次观察无有效占用”与“有已释放历史”可区分；若显示历史，准确绑定原 claimId/version/owner/updatedAt 和读取观察时间，不把旧 scope 当现写权。
- 同 task 释放 C 后新 take D，当前 D 仍显著，C 只能是历史；不能用旧 released 推断任务永远空闲。
- 读取失败/陈旧观察必须保持未知，不能从行消失断言 release；真正接手仍须 D04 原子 take。
- 不新增 paused/实时写活动推断权威。active 文案继续只承诺已领取；若后继需区分“停写保留”，应消费明确的原 owner 声明并注明性质，而非从 Git clean、mtime 或 reviewed 自动制造事实。

这是验收边界建议，没有设计/修改 schema、ledger、registry 或第二份状态源。

## 3. 已有同题工作，明确不重复

DPERF04 固定 snapshot 的 `docs/evidence/wpf-dperf04/interface.md:50–66,99–105` 已覆盖独立 assignment unknown、原 observedAt、保留旧阅读并标旧、未登记 claim 的完整范围/next、A→B→A 与旧响应、focus/selection、原 scope textContent。其 `review-4fac/root.json` 已列 RAW-SCOPE / REFRESH-READING，后继 status 记录修复。故固定 main 的 scope 经 `app.js:137,176` 的 plain()、旧 detail 与刷新观察不同代、未登记 unknown 区消失等不作为本报告新发现。它们仍不能被称为已部署修复；本次只读 status 明示 NOT_INTEGRATED/browser NOT_RUN。

## 4. 对已审 DPERF04 固定实现 45f8 的最小差异核对

额外按 root 指定固定 `45f8a185ad0d43543a3c9eca7a29da97ebb31ba9` 核三 blob（不追 HEAD）：`aggregate.mjs:2,57–58` 转交 `matchAssignments`，但 `read-model.mjs:121–125` 仍从 byTask/unregistered 排除 released，全局 assignments 在 `aggregate.mjs:62` 与 `read-model.mjs:132–133` 保留。`public/app.js:53–55` 卡片空态及 `306–318` 详情（特别 `317`）仍称“尚无领取登记”。因此 G1 在 fixed candidate 也存在；新分代与保旧阅读没有解决释放历史区分。

后继精确产品交集是 `apps/execution-dashboard/src/read-model.mjs` 和 `apps/execution-dashboard/public/app.js`；消费回归交集为 `apps/execution-dashboard/test/summary-detail.test.mjs` / `summary-detail.browser.mjs`。`aggregate.mjs` 已委托 helper，单从本问题没有必要预领或直接改它；ledger无需变化。以上都属于现 DPERF04 owner 写权，应等原片交回并由管理串行协调。这不是现在修改 candidate、耗用其剩余 browser 预算或阻断原限定 summary/detail 交付的建议；用户辨识后继仍归 D04-03 / D01-02/03。

## 5. 方法与限度

按现 AGENTS 和本地 find-skills 方法复用 find-skills / codebase-design / clean-code，路径/hash见 `audit.json`。本段 clean-code 核查聚焦“分配 authority / 来源观察 / UI 阅读”的职责，保错误与空态差别，避免为文案引入权限引擎。单一可追溯显示差距 G1；未发现需要另造实现任务的新原子互斥问题。

0 产品 import、测试、服务/API、PG、Chrome、空间采样、凭据读取；0 项目/计划/claim/Recovery/candidate 修改。仅本目录报告与源 hash。没有动态复现或正式实现 APPROVED，不保证当前部署、真实 ledger 内容、所有未来消费者。
