# RECOVERY01-05 原验收收敛

固定组合源码 `2f8cc1f61d32f518998a64d0adeec582f85481f2`；读取 metadata `10b559a58a112eaeb59345a88978b338b75e7ba6`。19个必要固定输入及Git blob/SHA见 `pins.json`。本批仅源与已有实证核对，未运行检查或服务，未改19源码及原raw。

**结论：0141完整源审明确列出的Web验收缺项已有逐项actual/controlled来源；没有发现需要为TODO05再跑一条“通用重连”旅程的证据。** 建议root用此矩阵作一次组合结论。05暂只等待该结论与下述原中心合同来源对齐；06仍保留最终独审/main接收。作者不自签整feature通过。历史审查中的PENDING仅属当时，不能在后继完成后机械累积成新门槛。

行号均指固定2f8，简写 B=`apps/web/test/conversation-recovery.browser.ts`，T=`apps/web/test/conversation-recovery.test.ts`，S=`apps/web/src/connection/session.ts`；以下review均为固定10b559的 `docs/evidence/wpf-conversation-recovery/` 原件，完整执行/source SHA在原件和pins中。

| 原触发与预期 | 精确入口与已有证据 | 当前判断 |
| --- | --- | --- |
| Cookie身份读取；刷新后显式恢复稿/原unknown命令，不自动发业务POST | B541、1132–1225；`continuous-first-root-review.json:89`，0141/exec765ab full7 | **actual PASS**。包括真实IDB、材料原序/未验证拒发、跨tab CAS、同turn/task原key/body replay、下一稿及双390/键盘。不是当前target全套重跑。 |
| 页面不reload时认证过期且新稿仅在内存；public Connect后保原稿/0新增业务POST | B1226–1256，特别1250–1254的timeOrigin/文本/POST；同full7 coverage `pageOnlyAuthLoss=PASSED` | **actual PASS**；不能再写“重新认证未验”。 |
| 网络offline→online后恢复原稿，不取消或自动发送；无CSRF写入被拒 | B1257–1263；同full7 `csrfOffline=PASSED`；S120–124恢复时public read | **actual PASS**；不等于断线后所有SSE replay/cursor排列均已验，但原要求没有把穷举排列设成新门槛。 |
| 用户在Change connection填写时后台session read不得关闭表单 | B586–625；`continuous-second-root-review.json:7`，55b/exec0a661 | **actual PASS**，闭合0141 SELECTING P2的定向App验证。 |
| CREATE ACK丢失，只由显式重试继续原两key/body；已绑定CREATE后turn ACK丢失不得重建conversation | B735–813；`continuous-third-root-review.json:112`（67f8/execbeb6），`continuous-fifth-root-review.json:4`（344f/exec7c7ee） | **两故障点actual PASS**；同conversation/turn/task与下一稿。旧parent overall FAIL原件保留。 |
| Queue enqueue未知ACK，恢复后原revision/key/body、同item/sequence、两file refs顺序及下一稿 | B814–853；`continuous-sixth-root-review.json:4`，344f/execfafc | **actual PASS**；非Queue promotion，后者不改变本片enqueue恢复验收。 |
| 已打开任务详情被动收到第二public消费者的取消事件，新cursor/timeline且无REST补读 | B547–585；`continuous-seventh-root-review.json:50`，d68/exec1357 | **actual task-SSE delivery PASS**；已补0141只握手缺口。非assistant patch/native正文、非断线重放全排列。 |
| 新稿先选profile/project并真实Prepare；保存knowledge+双有序file、reload/reauth/显式Restore不POST/不预取正文，显式逆序metadata验证后首turn精确refs | B992–1131；`continuous-tenth-root-review.json:98`，2e7203/exec7fb | **actual PASS**；真实public synthetic publisher，不是native模型。原两次红保真。 |
| 同document晚view仍有durable原turn；Steer草稿恢复、ACK未知→原key/body/command replay、下一稿保留 | B854–991；`stale-route-first-root-review.json:287`，a803/execd06 | **actual PASS**；一public synthetic actor成功claim/session。中心accepted/replayed，不冒runner consumed/applied。 |
| 同origin/baseURL/context/IDB从真实A→B→A→B；B不见/不发A命令，回A显式原key恢复，回B显式保B稿 | B627–734；`two-center-first-root-review.json:256`，2f8/exec2917 | **actual PASS**。held旧GET实际`abortedWithoutDelivery`，没有晚成功交付证据。 |
| 只改变principal仍须隔离；忽略abort的旧ready不能夺回当前authority/CSRF | T566–611；`two-center-source-local-root-review.json:143`，2f8新2PASS/55未选 | **controlled PASS**，使用真实ConnectionSession/Journal/privateRecovery及受控transport。公共principal-only rotation未actual，不能改写为已验；原plan03要求隔离，没有要求制造公共rotation操作。 |

## 真正尚待的决定/来源，不是追加运行清单

1. **TODO05组合证据判定**：`0141-feature-root-review.json:132`原remainingCoverage只有SSE、两CREATE、Queue/Steer、完整profile/knowledge/steering及second-center/principal。上表逐项闭合；最新2f8是harness/direct增量，生产16源同已审a803，历史结果各保绑定。root需判断组合证据是否满足原03/05；不应因为各单次review写“非wholefeature”而要求重跑全部绿色。
2. **原中心合同来源**：`plan.md:13`和`interface.md`明确保留callerOrigin、迟到Clear-Cookie、重复Connect32slot由中心owner核准。本批19输入没有该三项专门的共享方验收回执，不能自称closed。具体触发分别是public origin经过代理、旧认证响应与新Connect交错、重复Connect会话容量边界；预期须以中心已有固定合同/owner结论为准，不在Web自行发明重试/幂等或rotation规则。最小后继是root/Lead链接已有固定来源并判兼容，若确有未满足项再精确交原owner。已过same-origin cookie/reauth与generation受控测试不替代所有Set-Cookie服务端竞态；也不能把这三项笼统变成重新跑Web重连。
3. **明确非新增门槛的限制**：晚成功GET只有controlled证据，实际abort诚实保留；public principal rotation无本片操作；SSE reconnect/replay组合、assistant-v2、native consumed/applied、Queue promotion未在本批实证。这些不是0141 remainingCoverage中新加的provider或公共合同实现任务。没有依据因上述限制再次扩runtime/actor/DB范围。
4. **TODO06/交付**：完整固定组合独立结论与合法main/安装接收仍待。旧失败、分轮类型/受控与actual边界继续保留；IDB strict耐久hint不保证断电/清库。恢复列表可读性是既有非阻断后继，不混成本次验收。

当前双中心phase实际13020/余76980；所有更早phase封账，不转信用，不因这份矩阵产生下一run/env/gate或资源预约。clean-code应用：以触发/可观察结果组织，分清authority、证据等级及历史状态；不制造重复测试或新任务层级。
