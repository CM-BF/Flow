# R3 兼容读取接缝修复

R3 的 `WEB_COMPATIBILITY_INVALID` 来自旧 facts 相对引用的 format-1-only reader 扫描已导入 C3 format 2；发生在 Pool 构造前。它不是已证明的真实 App 不兼容。原 R3 已限定独审，个人只读确实发生、0SQL/completed[]、两直属PID absent/双EOF；不能由此确认全部个人服务或重述 R2 后台身份为 R3 fresh。

唯一 helper 变更在 personal-history-compatibility 的 `c51bffb4f91a33eeb16d637449c0618cc99040e8`，短 claim `037f8e52-3c52-422f-bfeb-f32990d716c7` v1 仅含 facts.mjs。snapshot 新增可选 findCompatibility port，默认历史 reader 不变。SVC06 的 continuation-facts.mjs 注入已固定 root 现代 reader，继续用原 snapshot/SQL/durable；不复制 observer。

旧 pointer/af51/null-context 报告与新 6c/browser policy 的 C3 tuple 分开校验；现代 reader 能跳过合法不同 tuple，任何损坏报告仍拒绝。原 migration 53 runtime pins、8 observer pins、R2 inputs 和已消费四阶段保持；facts helper 是新增一项显式 pin，不冒原53中已有或覆盖旧绑定。现代 reader 的直接依赖已在原53中。

新参数只改为未消费 personal-maintenance-r4 / r4-outer 和固定 `Node continuation-facts.mjs --snapshot <exact-output>`；原维护阶段、900秒外层、strictIdle、未知KEEP保持。当前没有个人窗口，不执行任何真实阶段。

## 原始局部结果

- 首轮112ms，4个文件fixture中2通过、2正例失败；mkdtemp返回/var路径而真实reader要求canonical /private/var。只修自有fixture realpath，原guard未放宽，原raw保留。
- 第二轮200ms：原4例4/4；真实Node薄入口的参数/加载检查exit0；原Python12阶段参数检查exit0。没有调用snapshot/maintainPreview/Pool连接。
- 合计312ms、3554B原始输出，4个组absent/双EOF、2个exact空scratch removed。4不同unit例、分轮8次选择；另2入口检查。0个人I/O/PG/HTTP/provider，不重跑旧31/487ms、7idle/deadline检查或R2/R3。

质量复核：单一reader端口、原默认行为、明确旧/新tuple所有者、失败保守及固定输出界限；没有新FSM或监督循环。原完整任务和实际后台维护仍未完成。来源、hash与真实时间见同目录 manifest.json 与 validation*.json。
