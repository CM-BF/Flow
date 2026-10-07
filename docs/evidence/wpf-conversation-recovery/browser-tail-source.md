# Recovery browser parent 尾部源码修复

时间：2026-10-06 19:27:59 UTC。输入metadata3896ca58a5c096e97f2816cc2066a537dcf0439e；输入source7cc7629b6603a6ccc7e2ab6143125dea8daae685。仅原browser父监督及own记录，完整feature target UNKNOWN / review NOT_STARTED。

依据为原样归档的browser-tail-root-review.json、browser-tail-peer-report.md与browser-tail-peer-audit.json。权属采用browser-tail-claim.json的2026-10-06T19:18:39.046Z观察（6ff v4/原21/唯一owner/无overlap）；后续管理通知D04不可用，此刻账本未知，没有再次查询或把旧观察称为fresh。

## 最小生命周期改变

- 删除权限改为显式allOwnedGroupsAbsent；仅负PID探测的ESRCH构成该组不存在，活跃、未知错误、无确定PID均保留scratch并使cleanup失败。既有exit/signal记录保留，不依赖错误文字正则决定删除。
- 停止并收割自有组后、删scratch前分别观察scratch/evidence/free。配额/采样失败加入原始errors并判失败；已确认组消失时仍继续安全删scratch。DB close失败被记录，后续安全步骤不被跳过。treeBytes原ENOENT处理逐字不变。
- report与budget写完后做终态计量；失败只做有限纠正写入，不循环重写。最后stdout输出recovery-final-accounting，包含实际postWrite.elapsedMs/逻辑字节/free/errors等。下次合法运行应把父stdout单独保留，不能只引用较早budget.elapsedMs。硬截止直到最后收尾仍有效，若在最终记录阶段触发先使budget complete/cleanupComplete=false。
- 显式MAC_CHROMIUM_TMPDIR与TMPDIR/TMP/TEMP均指同一owned scratch；launch-config.json仅记录白名单临时路径与Chrome固定argv、worker脚本入口。继承环境、env-file参数和凭据不序列化；HOME、Chrome默认sandbox、实际原启动参数不改。

## 边界与待验证

本段只有源码读取、差异与hash核对，0产品import、types、测试、HTTP、PG、Chrome、free采样、安装或构建。父仍只在准入/监测开始后动态导入fixture；没有复制另一个runner或Settings收集器。38项direct绑定7cc且只代表原受控运行，本次未复跑；worker场景完全不改。两个尾部finding当前仅SOURCE_ADDRESSED待独立审查，不称行为通过。

原browser10raw逐字保留：14846.267375ms=14.846267375秒，剩75153.732625ms包含15000ms清理，仅算术不是重试许可。计时仍在现preflight后开始，终态stdout另外给写记录后的实际观察，不回填旧raw。250ms采样及尾部逻辑字节统计不是物理硬quota；未知组留scratch可能需要后继人工处置，不授权终止其他进程或删除他方目录。完整三中心语义与真实默认保存/材料恢复旅程仍开放。
