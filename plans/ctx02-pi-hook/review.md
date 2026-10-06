# CTX02 独立review

状态：APPROVED

Review target commit：8abe014f61df5ed7e1548e30d53538e7c4580c4c

范围仅本固定Pi/插件零模型探针和保存证据，base e802854f346a81749efdef3f36737b16141b98ef。请核实际source、版本/许可、OS与JS隔离区别、真实SDK seam、双session隔离及store生命周期、缺失/未知行为、compaction唯一owner、未运行项和原始失败。不得把model prompt未调用的hook探针当完整harness/provider兼容。独立结论见下文。

作者证据：[完整方法](../../docs/evidence/ctx02/README.md)、[默认入口拒绝](../../docs/evidence/ctx02/04-real-hooks.json)、[factory最终](../../docs/evidence/ctx02/07-stock-factory-lifecycle.json)、[固定来源](../../docs/evidence/ctx02/provenance.json)、[raw manifest](../../docs/evidence/ctx02/raw-manifest.json)。最终source hash在07中可核，默认入口源码固定9733f4b。只读复核即可，不重跑模型/负载。

关注：默认ResourceLoader越界发现失败与factory显式空资源注入的准确差别；真实ExtensionAPI/SessionManager/工具与生命周期；OS网络/fork/写和Node读取权限分别验证；未来sidecar仅警告后写回1是未修的采用缺口，不是拒绝检查通过。先前01/02/05/06失败保留，不能把最终观察回填旧源码。此项作为采用前门禁保留，不要求本实验修改stock。


## Root 独立只读审查（2026-10-06，owner于05:11:55 UTC转录）

审查者：Root / gpt-6-astra；结论APPROVED。起点及终点clean HEAD9084095f182fc5dbfe4df6077a2afaf2a4b83386，固定实现8abe014f61df5ed7e1548e30d53538e7c4580c4c。

实际已读两脚本279行、README、最终7组及历史04–06、真实SDK祖先扫描与stock sidecar load/save；核15 Pi+5 plugin源hash、2脚本target hash、7 raw hash。独立重算8原文hash及48,168B，核约2697ms记录累计、临时目录与marker清理。未重跑tests/实验、未调用模型、未写项目文件。

无blocking finding。批准仅6组断言+1组实际存储行为观察；默认ResourceLoader隔离失败和future999999警告后写回1均为明确采用缺口。显式factory入口、手写summary、同进程重开不证明native/model resume、token收益或生产兼容。

作者回应：保留所有失败和raw；正式采用前要求默认资源隔离、未知schema fail-closed或显式受审迁移。当前不patch上游、不追加实验。源码不变，等待Lead main receipt。
