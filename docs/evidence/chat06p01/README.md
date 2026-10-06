# CHAT06P01 证据索引

当前只有来源与方法准备，没有PG测量结果。权威进度见[status](../../../plans/chat06-stream-cost/status.md)，[实验合同](../../../experiments/assistant-stream-cost/README.md)。

- [原子claim](claim-receipt.json)与[请求](claim-request.json)：成功后开始本scope写入。
- [固定源文件hash](source-map.json)：main fa9的只读接口依据，不当实测。
- [技能与质量](quality.md)：本地优先、固定clean-code、来源/预检纠正与度量边界。

真实结果/失败/cleanup/manifest将在窗口授权并实际运行后另保存，不预造数值。main生产已含CHAT06，原CHAT06工作树的旧status不覆盖本固定main事实。

纯生成器固定37709097b879a7afff32b25da971f559d740058a：[preparation-manifest](preparation-manifest.json)绑定3个不同纯行为/noEmit0及所有初失败。执行方式为Node24运行 experiments/assistant-stream-cost/check.mjs unit|types <唯一标签>，不会启动PG/server/model；生成器只做预计算，不含性能时钟。测量入口尚未实现。
