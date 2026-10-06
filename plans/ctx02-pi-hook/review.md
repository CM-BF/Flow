# CTX02 独立review

状态：NOT_STARTED

Review target commit：8abe014f61df5ed7e1548e30d53538e7c4580c4c

范围仅本固定Pi/插件零模型探针和保存证据，base e802854f346a81749efdef3f36737b16141b98ef。请核实际source、版本/许可、OS与JS隔离区别、真实SDK seam、双session隔离及store生命周期、缺失/未知行为、compaction唯一owner、未运行项和原始失败。不得把model prompt未调用的hook探针当完整harness/provider兼容。当前尚无approval。

作者证据：[完整方法](../../docs/evidence/ctx02/README.md)、[默认入口拒绝](../../docs/evidence/ctx02/04-real-hooks.json)、[factory最终](../../docs/evidence/ctx02/07-stock-factory-lifecycle.json)、[固定来源](../../docs/evidence/ctx02/provenance.json)、[raw manifest](../../docs/evidence/ctx02/raw-manifest.json)。最终source hash在07中可核，默认入口源码固定9733f4b。只读复核即可，不重跑模型/负载。

关注：默认ResourceLoader越界发现失败与factory显式空资源注入的准确差别；真实ExtensionAPI/SessionManager/工具与生命周期；OS网络/fork/写和Node读取权限分别验证；未来sidecar仅警告后写回1是未修的采用缺口，不是拒绝检查通过。先前01/02/05/06失败保留，不能把最终观察回填旧源码。当前NOT_STARTED，无独立批准。
