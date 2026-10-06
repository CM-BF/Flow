# ATTACH01 phase1 validation

固定实现 `311a932f6bef0efe81367569da00c13bf3bf6ac8`；base `f181d84b5fb3652d62e2a181acff442d42b3e066`；2026-10-06 10:20:46 UTC。

- 39 attachment/compatibility tests + 8 unchanged legacy context receipt tests = **47/47 PASS**，Vitest4.0.18，2026-10-06 03:21:23 -07 / 10:21:23 UTC，514ms；[原日志](additive-direct.log)。
- Node24 / pnpm9.15.4 根 `pnpm exec tsc --noEmit` exit0；[日志](additive-types.log)为空是成功退出，没有隐藏错误。
- [additive-checks.json](additive-checks.json)保留真实执行时196cee3+dirty。三源hash于完成后立即采集，无中间源码更改；不是声称在后来的固定SHA重新执行。14个直接只读依赖均与f181相同。
- 实现三个文件 staged diffcheck0；新manifest与根lock/现旧Web/client/共享exports无修改。根依赖仅offline frozen install（[log](install.log)），不安装新依赖。

覆盖UTF8边界/非法字节/BOM/CRLF/原digest、header-safe upload key、不可变ref与元数据不含正文、ready原receipt和当前expired/unavailable分离、namespace非auth、v1 wire/旧detail不变、v2完整顺序/identity/合计预算/错误ACK。

兼容增加真实旧函数+FlowClient/mock fetch：旧strict request拒attachments:[]；GET保留v2metadata而正文不变/0内容请求；Send/enqueue若错回v2则unknown、重试同key/完整body并接受原v1。未实现新client序列化或后端，不能将此当端到端HTTP。

保留历史而不冒充全为产品红：first-direct.log为首31合同通过；first-typecheck.log的ES2023不支持String.isWellFormed已用Unicode surrogate显式验证修正。checks.json/direct.log为后来40项检查；不是最终45项。兼容fixture初次import @flow/client在contracts package无声明解析失败（8旧tests过，新suite未收集），已改显式只读相对入口；随后[compat-first.log](compat-first.log)44过1失败是作者fixture误开queue却未加载队列，实际send门禁正确，已改为false的普通Send场景。未改生产门禁来适配fixture。

raw测试日志含Vitest格式空白原样保留，不声称全raw证据diffcheck0。无browser、截图、HTTPserver、PG、model/provider或个人服务操作。后继真实PG/HTTP、cap发布、资源retention/授权原子性、完整prompt冻结及runner读取尚未验证。

共享ACK对齐追加：producer reference严格schema继续拒多余字段；consumer `conversationContextResponseSchema` 从同一结构派生逐层strip，复用locator/source/合计refinement，保持已知identity/version/order/bytes严格。`parseAttachmentContextReceipt`用消费schema且不保留未知字段到状态。新增future字段全层剥离和错误已知字段回归；final-checks.json与compat-green.log是此前45项历史，additive-checks.json才绑定最终47项。
