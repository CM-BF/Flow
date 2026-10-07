# 新Web779a / 后台cd27精确兼容准备

固定源码 `2f6792ca3f19fcd1d54563531c302937f607c892` 仅fixture三处guard：分别校验完整Web c231/779a和backend04da/cd27 descriptor，保真实manifest/hash/release验证。不再要求共源，不接受调用者自报或旧6c fallback。browser逐字8964，旧3AppBearer+各4check、新Cookie恢复/原keyACK/迟到logout链均保留。

[实际输入](inputs.json)、[74pins及边界](binding.json)、[静态检视](static-audit.json)、[准确TMP包与差量入口](index.json)。`/private/tmp/rel01-recovery-c1`复用c3父生命周期；worker只选已审新Cookie入口，父只改验收3→4及固定TSX配置解析Playwright。源码/包集中审尚待，nativeApproval=null，PREPARED/no gate/no runtime。最终metadata HEAD只在TMP routine重绑。

新提案180s含30scleanup，1markedDB/12配置连接/1Node组/1Chrome组、2动态ownedHTTP，64MiB scratch+128MiB DB/WAL规划+8MiB retained（含256KiBouter）+1MiBmetadata；完整floor至少14,625,734,656B或当时更高。旧23495兼容及25241构建段均CLOSED，不转信用。本准备无Node/product import、PG/HTTP/Chrome、安装、build或资源采样。实际仍由manager唯一窗口安排。

完整产物及调用源分别固定；旧只读donor继续只读，未建本树node_modules。公共origin61228仅真实Chrome页面经exactproxy；Node/PW APIRequestContext无该直访权。失败/unknown清理保持FAIL/KEEP，四报告必须真实正常清理后import/verify。
