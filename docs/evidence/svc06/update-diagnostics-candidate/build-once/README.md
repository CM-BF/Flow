# 固定诊断产物构建准备：NOT_RUN

唯一入口 supervise.py → entry.mjs → 既有prepare/verify → 新产物runtime-proof。直接沿已审且成功的 update-b2b-candidate/build-once；本目录只固定6c来源、新目的与诊断模块的内部加载断言，无builder/安装器/监督器产品修改。

执行方式（只有Lead给actual窗口后，cwd为backend-release）：

```sh
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/opt/python@3.13/bin/python3.13 docs/evidence/svc06/update-diagnostics-candidate/build-once/supervise.py
```

原420+.5+2秒、raw2MiB/outer1MiB、fresh3,927,965,696B/live1GiB与2,317,352,960B新增规划不变，见[候选](../candidate.md)和[固定输入](inputs.json)。stage/install及final通过rename不重复计，但selected-seed/source archive/home/cache/metadata/raw同时存在的规划保留。不假设CoW节省。

actual-first与outer-report.json必须不存在；运行前fresh核claim/72source、17真实runtime bytes与realpath、源tree、实际并发空间，未知停。此prepared packet不创建reservation/私有根，不install/import/PG/provider/个人读取。失败/超时保stage/lock/原件，无自动重试；成功也保留新artifact以待后继真实host。

[源差量](../source-delta.json)证明父b2b仅四已审文件变化；[索引复核](../cache-index-refresh.json)只271固定cache index hash，不替代实际clone完整内容校验。旧c2c/r1完全保持。旧已绿局部与旧构建不重跑，本新完整产物仍需实际执行和结果独审。
