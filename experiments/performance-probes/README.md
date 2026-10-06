# LAB01 本地性能 toy

两个独立 vanilla 页面样例：相同工具结果的完整/按需读取，以及相同 8,192 个逻辑事件的逐条/有界批量 DOM 更新。仅用于观察取舍，不连接 Flow 中心、模型或云。结果与边界见[报告](../../docs/evidence/lab01/README.md)。

需要已有 Node 24、Playwright 1.63.0 与本机 Google Chrome；不安装浏览器，不修改根依赖。当前机器可只读复用已存在的模块：

```sh
cd /Users/citrine/Projects/AgentHarness/Flow-worktrees/performance-probes
export LAB_PLAYWRIGHT_MODULE=/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-integration/node_modules/@playwright/test/index.mjs
/opt/homebrew/opt/node@24/bin/node experiments/performance-probes/benchmark.mjs
```

脚本使用独立随机 loopback 端口、浏览器临时 profile，等待页面 ready 信号，结束关闭浏览器和服务器。正式运行覆盖 `docs/evidence/lab01/results.json` 与四张截图，因此复现前应在独立工作树保存原始证据；`--smoke` 只运行每策略一次、写 `smoke.json`，不产生统计结论。默认每策略 2 次预热、20 次测量，样本超过 9 秒即失败，总采样预算 120 秒，API 未压缩传输上限 64 MiB。

手工查看：

```sh
/opt/homebrew/opt/node@24/bin/node experiments/performance-probes/server.mjs
```

打开输出的本机地址（默认端口 4338，可用 `LAB_PORT` 改）；完成后 Ctrl+C。完整/按需按钮读取时间线，展开按钮检查首条详情摘要；另一组按钮处理同一份模拟事件。界面展示末次样本，不是统计汇总。`benchmark.mjs` 负责环境、正确性、统计和截图；`server.mjs` 负责固定数据与 gzip HTTP；`app.js` 负责页面行为和浏览器测量。
