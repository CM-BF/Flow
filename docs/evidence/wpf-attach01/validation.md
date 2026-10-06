# ATTACH01 phase1 validation

固定实现 `6bc2918cf35a652e241e6378c3b6297cac179adb`；base `f181d84b5fb3652d62e2a181acff442d42b3e066`；2026-10-06 10:25:00 UTC。范围是两个合同源和一个专测；独审尚未开始。

- **49/49 PASS**：41 attachment/consumer tests + 8 unchanged legacy context receipt tests，Vitest4.0.18，2026-10-06 03:23:53 -07 / 10:23:53 UTC，471ms（tests40ms）；[原日志](resource-direct.log)。
- Node24 / pnpm9.15.4 根 `pnpm exec tsc --noEmit` exit0；[日志](resource-types.log)为空是成功退出。
- [resource-checks.json](resource-checks.json)保留真实执行时52317c4+dirty；执行前采集三源hash，完成后逐一验证未变。[candidate.json](candidate.json)绑定其字节到最终实现，不声称在后来SHA重跑。14个直接只读依赖与f181相同。
- 实现三文件diffcheck0；manifest/lock/旧Web/client/共享exports无修改。仅offline frozen install既有依赖（[log](install.log)），无新依赖。

覆盖UTF8边界/非法字节/BOM/CRLF/实际digest、header-safe original key、不可变ref与元数据无正文、saved ready receipt/current expired或unavailable分离、namespace非auth、v1 wire/detail不变、v2完整有序身份/总预算。消费者逐层忽略future字段但不放松已知字段；bare frozen references可供共享decoder直接验证，可选完整resource metadata进一步核name/type/bytes，无需caller伪造不可得事实。

兼容用例直接运行与f181字节相同的旧ConversationProjection、QueueCommands、ConversationQueueProjection、conversationMessages和FlowClient；只有fetch为mock：旧strict request拒attachments:[]；GET保留v2metadata但正文不变/0内容请求；Send/enqueue错误v2 ACK保持unknown和原key/body，重试可接受原v1。未实现新client序列化或后端，不能称端到端HTTP/部署兼容已完成。

历史记录原样保留：

- first-direct.log为首31合同通过；first-typecheck.log的ES2023不支持String.isWellFormed已用surrogate规则修正，未改编译配置。
- checks.json/direct.log为40项；final-checks.json/compat-green.log为45项；additive-checks.json/additive-direct.log为47项；wire-checks.json/wire-direct.log为48项。这些均不是最终49项。
- 兼容fixture初次@flow/client在contracts package无依赖解析失败，新suite未收集，旧8通过；改显式只读相对入口。随后[compat-first.log](compat-first.log)44过1失败，是作者fixture开启queue却未加载page触发正确门禁；改普通Send场景queue=false，未改产品门禁。

raw日志Vitest格式空白保留，不声称全raw证据diffcheck0。0browser/截图/HTTPserver/PG/provider/model/个人服务操作。后继真实PG/HTTP、cap发布、retention/授权原子性、prompt冻结/runner材料一致性尚未实现验证；不把schema成功当ready权威。
