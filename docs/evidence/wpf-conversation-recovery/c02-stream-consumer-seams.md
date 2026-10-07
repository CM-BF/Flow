# C02 流 v2 消费接缝（只读，未实施）

记录：2026-10-07 04:45:38 UTC。Recovery 固定 `7440b59c2fe64d696ca7afd3ab7c5ff3b135e43d`；C02 实现 `9e212e503575f8f8d6d45b4cb38032f6ec604de9`、cleanup `6cbe91ff4f0839da185d75a3ab0440f0ace83060`；公开说明包 `d5273fb7de98d8ef032f3f42a34e6387710f1899`。逐源 SHA256 见 [source pins](c02-stream-consumer-seams.json)。C02 独立源码审查/主线接收仍待，不把接口候选当已交付能力。沿原 MATURE06-04 / RECOVERY01-03、-05、-06记录依赖，不新建task或领取后继范围。

## 当前真实消费者与必要变化

1. **HTTP opt-in 和内部 host 必须一致。** App.tsx:1229 的 cookie client、1278 的初始 fixture client、1279 的 reconnect client 都显式 patch-v1。C02 public client index.ts:45–68允许 patch-v2，94–105 的 task metadata/patch/block 与474–477的conversation请求传现公开协议头；无需复制HTTP层。未来三个入口要一起采用已审固定公共输入，保持cookie/CSRF、retained原client/session与namespace代际，不以fixture-only结果冒生产接通。

2. **另有共享协议门禁，不能只改 App 字符串。** Web host.ts:123/131/151 三个 updateHost 分支仍硬编码 patch-v1；C02 固定共享 projection.ts:12 的 StreamHost.protocol 仍仅 v1，57 的 enable严格等v1。Web应从同一已选协议传递启停输入，不让HTTP v2与host v1名义错配；共享owner须先给明确v1/v2兼容与能力门禁的固定实现/独审，本批不擅自改它、用cast或绕过enable。

3. **公开 reasoning 独立呈现。** messages.ts:7–12将每个draft无条件转text且flowStream metadata未保source/channel；14–22 final路径也是text。C02 presentation.ts:40–53已经输出source/channel，56–65保中心显式settlement和canonical final。未来仅把channel=text映为text，已公开reasoning-summary/reasoning-text映为既有reasoning part；保两种reasoning通道可辨标签与已暴露source/channel/stream identity metadata。缺失或未公开reasoning不得生成、推断或填占位正文；BodySegment没有nativeTurnId就不伪造。不得按相同文字去重或令draft覆盖final。Thread现有ThreadComponents.ReasoningGroup、groupBy(:102–104)、GroupedParts(:610–651)与reasoning.aui.tsx:59–80可复用；本方案不要求新增renderer/公开slot/第二store。

4. **生命周期沿现权威。** host.ts:106读前后授权检查、123撤权、129–132deactivate、157–159dispose保持；App.tsx:1242–1274保留原namespace/client/session。公开流只读，不自动重投任何恢复receipt；停用插件/隐藏pane/旧连接失效后不让迟到结果落新scope。C02 contracts assistant-stream.ts:30–46明确Codex须nativeTurnId/channel并用不同身份元组，不能把新源伪装旧Claude。

## 精确后继范围（提案，不是现有写权）

最小Web生产三路径：`apps/web/src/App.tsx`（在原21）；`apps/web/src/conversation-stream/host.ts`、`apps/web/src/conversation-stream/messages.ts`（均**不在原21**，必须fresh精确派权）。复用既有验证入口，按层选取：`apps/web/test/conversation-stream.test.ts`（message/channel/final映射）、`apps/web/test/conversation-stream-projection.test.ts`（public readers/protocol暂停与代际）、`apps/web/test/conversation-stream-integration.test.ts`（真实host授权与租约）、`apps/web/test/conversation-stream-integration.fixture.ts`和`apps/web/test/conversation-stream-integration.browser.ts`（已存在的实际UI fixture/browser入口）。这五个测试路径也不在原21；这里只给需要的候选路径，未领、未写、未运行。fixture/browser仅核固定存在与hash，未重审整套场景。

共享输入由C02 owner负责：`packages/contracts/src/assistant-stream.ts`、`packages/client/src/index.ts`、`packages/interaction/src/stream/presentation.ts`的已审组合，以及 `packages/interaction/src/stream/projection.ts`的protocol gate兼容修正/既有共享测试。Web不复制decoder、不扩当前Recovery claim、不会接管C02。

后继定向验收：三个App入口与host的v2选择一致；旧Claude v1语义不变；同item/不同channel身份互不覆盖，reasoning-summary与reasoning-text可辨且缺失不猜；incomplete/paused/terminal与canonical settlement仍据公共状态；插件停用/隐藏/换连接/重新认证后迟到响应不能渲染或引发mutation；真实Thread以既有reasoning disclosure/键盘入口呈现，不能只用纯mapper断言代替挂载。实际运行需后继正常调度，不挪用本次Recovery剩余预算。

Root已通过assistant-ui官方Message/ExternalStore文档复核现有公开接口（来源归root，非本批新浏览）；本报告直接核固定本地renderer源码。方法使用本地find-skills、assistant-ui、codebase-design与clean-code：唯一流状态/协议来源、私有authority保留、缺失与失败显式、不加多余抽象。本批无产品import/测试/HTTP/PG/Chrome/容量或个人服务采样。

## Recovery 状态与计时边界

只补元数据。计划创建13:49与claim13:46都不能证明首次实际工作时点，任务开工填写UNKNOWN；完整验收尚未完成，任务完成NOT_COMPLETED，不用commit时间补造。原50受控PASS和真实browser失败分层保留；晚累计38364.050667ms/90000，下一整数最多51635ms含15000清理，无新许可。完整feature target UNKNOWN、review NOT_STARTED。当前main own-status-parse只核元数据形状，不证明C02接入、主线、部署或浏览器通过。
