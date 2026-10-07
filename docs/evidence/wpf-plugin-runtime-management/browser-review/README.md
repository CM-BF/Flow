# Plugin b1 固定准备独审收口

[源码独审](source-review.json) 为 APPROVED_SOURCE_PREPARATION / 0 finding；[原生边界](native-boundary.json) 为 ACCEPTED，固定 target `0bc393de593fd9d057efa08cd6d4ff261f99b24f`。原件逐字归档，[静态输入核验](input-audit.json)保留当时观察，不冒新的运行解析验证。

本段只归档与元数据绑定；六组 browser / 两390图 / visual 均 NOT_RUN，生产App与main未集成。旧strict/direct15限定通过及原30082ms父FAILED完全保留。Chrome保留内建sandbox，但没有自定义外层OS写入/egress隔离，限制见已接受的原生边界。

[本次事实](seal-record.json)记录 fresh claim 与未来资源下限：至少6,795,821,056B或当时更高完整组合，未采free、未创建gate、未占用资源。个人服务排他窗口未见实际RETURN，不能启动。60s含15s清理 / 64MiB scratch / 8MiB retained / 1MiB metadata仅准备边界。

`/private/tmp/prm-b1` 中旧 binding/manifest/README/handoff 保留为 `.before-review-seal`；正常metadata提交后再将TMP的HEAD绑定到实际最终commit。该最后TMP绑定是准备artifact，不递归创建项目提交；最终handoff给manager。源码/5 runnable/pins/6断言不改。
