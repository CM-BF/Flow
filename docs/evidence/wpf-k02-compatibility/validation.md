# WPF-K02C01 验证

实现 target `7633937c322090bbd6d526f378df464f2a7436ed`；base `3d4985fca060155435b159e0467815bf8e88b8b8`；输入提交 `e9a0259151fcb215e1bd607b5461d81412da2742` 原样消费三 contracts。审批只针对 Web 薄兼容，不声明 K02 领域后端批准。

## 实际检查

- 原实现+新增回归：2026-10-06 05:55:37 UTC，17 failed / 84 passed，根因为两处 projectId 丢失及 knowledgeContext 非boolean未拒绝。[原始red](red-direct.log)未改写。
- 初修：05:55:53 UTC，101 PASS。清码发现应补后续分页与 turn ACK 路径身份变化；新增该行为检查，生产代码无再改。
- 最终检查：05:56:16 UTC，四文件102 PASS（projection54、outbox11、queue16、profiles21），Web typecheck exit0、实现diffcheck exit0。精确命令/时间/日志见 [checks](checks.json)、[green](green-direct.log)、[typecheck](typecheck.log)。
- 测试捕获版本保留 `2fb1eed9fbb1111e9226f1da458c5612aeb84c6e` + dirty，六源SHA256逐一对固定target复算一致，见 [source binding](source-binding.json)。不把metadata HEAD伪称测试时版本。
- Node24 / pnpm9.15.4 frozen-lockfile 安装退出0，449包本地复用、0下载；root manifest/lock与app package零diff。@flow/client与contracts实际链接本树packages路径，无旧工作树依赖。

范围：project缺省/明确相同/缺失/新增/不同/非法，snapshot/page/later page/CREATE/turn ACK一致；未知回执原key/payload且新草稿独立；knowledgeContext缺省/false/true与非法值；保留context metadata、conversationMessages只输出实际文字、初始detail0；普通turn/enqueue未添加knowledge。沿用原lateACK/historygap、queue控制及O07 goal-tools/unknown禁选回归。

只改两个生产文件，outbox/queue writer/Thread/App/shared exports/client/backend根依赖均未改。metadata context只透传，不增加正文哈希猜测、引用发送或任何上下文详情请求。没有新浏览器/服务/截图/模型/真实DB测试；本片无视觉变更，不重复旧UI验收。未知原key跨reload恢复仍属于QUEUE F01后继。

独立review：root05:58:18限定APPROVED，独立102 PASS/六hash复核，未重复作者tsc或UI/DB/model，见 [review](../../../plans/wpf-k02-compatibility/review.md)。main未集成本片。完整base→metadata diffcheck exit2：仅原始patch第48/95行空上下文，Vitest red断言diff行尾空格及末尾空行，green/typecheck末尾空行。保留原字节；排除这些raw patch/log后的source/docs diffcheck为0，固定实现diffcheck为0。
