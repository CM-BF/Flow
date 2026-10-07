# WPF-DPERF05 validation

实际唯一 pure Node 运行绑定 implementation `c8d59449a5c4752fdf98a0cd7bb59653b6fbdab2` / runtime metadata `7311ac51113c27a8ddd0e368338dbb0f9e1037fd`。2026-10-06 19:14:51.981149Z 起；62/62 PASS，fail/cancelled/skipped/todo 都0，Node TAP duration 64.536708ms；父 result 201ms，落盘后 stdout actual elapsed 201.40412508044392ms。后者单独原样保存，未回填/改写 result。

15 秒含5秒清理额度，previous0；postWrite tmp75618B、raw21103B、result2452B，withinLimits=true。owned PGID22632 absent、scratch absent、cleanup fulfilled/errors[]，cleanup显示0.000s为原记录精度。额度余额约14798.596ms仅算术，无自动重试许可。采样不是hard quota/OS峰值证据。

原 [result](direct-first/result.json)、[TAP](direct-first/node.log)、[父stdout](direct-first/parent-stdout.jsonl)、[gate](direct-first/gate.json)、[归档hash](direct-first/archive-manifest.json)；原运行目录不改，candidate外 stdout 单独保留。

Source root 676b P2 CHANGES_REQUESTED 保留，c8d修复已有 root APPROVED_SOURCE_SCOPED_NOT_RUN；supervisor窄审通过后管理fresh gate才运行。此次实际 direct证据已获root限定独审通过，原文见[root-62-runtime-review](root-62-runtime-review.json)。

## 限制

此处只验证 parseStatus 纯函数与既有4helper加载路径，0HTTP/PG/Chrome/真实registry/部署。父源码核验用了只读 Git 命令，不创建Git测试repo。真实 aggregate malformed/duplicate/stale/future及fraction等价age验证由Lead集成另做；未复制age公式。旧676b/56从未运行，原source-only记录保留。
