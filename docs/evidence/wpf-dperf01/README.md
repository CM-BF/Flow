# 工程看板单快照重复核验消除

固定实现 `5cd7f00dbe091785b2b7be9cb2b03d33f2af8c52`，输入 `698ffcd94ae073b23bcc67f6665fb19f707a93e4`；分支 `codex/dashboard-proof-performance`。本片只在单任务、单快照、相同完整target时复用已经得到的实现比较结果。`proof.mjs`、registry、人类摘要逻辑、共享合同、根manifest/lock均未改。

## 观察与结果

Node v24.20.0，临时Git仓库及现有局部HTTP fixture；0真实DB/模型调用，0实际4320服务操作。Git Trace2仅由临时子进程环境启用，绝对临时文件随fixture清理，不改全局Git配置。记录的是Git进程`start`与`argv`，不是mock调用次数。每个快照包含fixture的两任务和临时main检查。

| 情况 | 目标比较次数 | 整个临时样本Git启动数 | 结果 |
| --- | --- | --- | --- |
| 固定698生产聚合 + 新测试，改动前 | 2 | 29 | 预期红灯：要求1次，实际2次 |
| 固定实现，相同目标 | 1 | 24 | 专用4项PASS |
| 固定实现，review与实现目标不同 | 2 | 未作为优化指标 | 独立比较，旧review正确变outdated |

减少的5次启动来自同一比较的target核实、scope核实、提交差异、dirty差异和untracked检查。下一快照仍执行一次完整比较；本片没有跨快照缓存。当前快照并非新增的原子Git事务，不声称消除了并发文件写入的所有采样竞争。main/tree相关读取保持原样。

## 检查与原始输出

- [红灯](red-tests.log)：4项中3PASS/1预期FAIL，基线比较2次。
- [固定实现专用检查](direct-tests.log)：4/4PASS，4059.64ms；语义包含同/异target、后续snapshot、dirty edit、删除、恢复、untracked新增、unknown/missing与恢复。
- [关联检查](related-tests.log)：26项25PASS/1FAIL，8569.81ms；包含专用4项、dashboard9项、human-proof13项。唯一失败为未修改的`human-proof.test.mjs:115`硬编码28个registry sources，固定698实际已有54。两源与698内容相同，已报Lead，未在本claim修复。
- `git diff --check`通过；`proof.mjs`、`registry.mjs`、`human-proof.test.mjs`、根`package.json`及`pnpm-lock.yaml`对698零差异。既有依赖以`pnpm install --frozen-lockfile --ignore-scripts`安装；无新依赖。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH env -u FLOW_COORDINATION_DATABASE_URL -u FLOW_COORDINATION_REPO node --test apps/execution-dashboard/test/proof-snapshot.test.mjs
PATH=/opt/homebrew/opt/node@24/bin:$PATH env -u FLOW_COORDINATION_DATABASE_URL -u FLOW_COORDINATION_REPO node --test apps/execution-dashboard/test/proof-snapshot.test.mjs apps/execution-dashboard/test/human-proof.test.mjs apps/execution-dashboard/test/dashboard.test.mjs
```

第二条命令目前会如实返回上述基线旧断言失败。记录测试耗时仅供执行审计，不能据此声称生产速度比例改善。先前实际API的三次波动不是benchmark，本片不引用其为优化依据。

## 交付边界

没有UI变动、无需新截图/新启动URL；已有服务保持原样。没有执行真实看板刷新benchmark、浏览器或全库检查。root于05:06:23 UTC批准上述固定实现，独立4项PASS/Trace2 24starts、1比较，无blocking。具体范围见[review](../../../plans/wpf-dashboard-proof-performance/review.md)；主线集成pending。领取[receipt](take-receipt.json)，技能及实际clean-code见[quality](quality.md)。
