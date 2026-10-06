# WPF-DASHSUM01 验证

固定实现 `c1de71fd316f9bba1ea5f030f5a54d2332d09044`；基线 `2c6df4754f4fea75fbb2e1e750cad89524b1f5fa`。4源码及浏览器捕获逐字绑定：[manifest](source-manifest.json)。本任务首计划 `48e7d736d55e3cf7d3a2fa86b8ae73408be3b4e6`；六scope见[原receipt](claim-receipt.json)。root独立review已APPROVED，main `017adc276a888a218bed3ef9963bc4dabbc6cec2` 已集成。

## 行为与检查

- 确认父关系+父current/完整摘要/active才共享首屏active及delivery摘要位；父自身优先级不继承子blocker。其它active、unknown、子blocker/decision独立保留。
- 父详情列known直属children的原产出与显式阶段，使用原任务按钮和单弹窗；Enter下钻、Escape返回原调用点。摘要只短领取/异常；完整lead/worker/co-lead仍在详情与工作线。
- [新测红日志](node-red.log)：旧实现8项中2失败；[首绿](node-first-green.log)：13/13；[最终定向检查](node-tests.log)：27/27（8摘要、5交付阶段、14原关系解析/聚合），exit0，532.659ms。最后浏览器脚本仅测试生命周期整理，不影响先前Node测试源码。
- `node --check` app.js与task-links.browser.mjs exit0；固定4源码 `git diff --check` exit0。frozen/offline安装见[原日志](install.log)，root manifest/lock零diff。
- [浏览器原报告](browser-results.json)/[输出](browser.log)：6组检查、5截图、页面错误0。2026-10-06 11:48:58.000–11:49:06.374 UTC，累计8.374秒/90秒（预留10秒清理）。`fixtureRemoved=true`、`serverClosed=true`、cleanupErrors=[]。报告内sourceDirty=true来自当时未提交证据/计划，4源码均与固定target相等。

运行命令（本树 cwd）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --test apps/execution-dashboard/test/human-summary.test.mjs apps/execution-dashboard/test/delivery-stage.test.mjs apps/execution-dashboard/test/task-links.test.mjs
env -u FLOW_COORDINATION_DATABASE_URL -u FLOW_COORDINATION_REPO PATH=/opt/homebrew/opt/node@24/bin:$PATH node apps/execution-dashboard/test/task-links.browser.mjs
```

预算由脚本读取累计[browser-budget](browser-budget.json)，本次没有重试。沿既有fixture创建临时本地Git来源及随机HTTP端口，注入领取身份仅测试DOM呈现，不接协调DB/4320/个人服务。原D08证据保持原样。本次截图/预算与方法不能当真实性能bench。

## 画面

[桌面浅色](home-desktop-light.png)、[桌面深色](home-desktop-dark.png)、[390浅色](home-narrow-light.png)、[390深色](home-narrow-dark.png)、[390详情](detail-narrow-dark.png)。作者实际目视桌面浅色/390深色/详情，自动校验全部画面无横向溢出、减动画。旧远端/HTML声明保持文本，0额外远端请求；未知领取标签保留。

## 限制

未验证真实多source部署、协调数据库、Safari/Firefox/屏幕阅读器；未跑无关工程全套。没有改proof/parser/registry/架构图或产品Web。原始日志不清洗；源码diffcheck为明确范围，不把安装日志格式当生产错误。独立审查已按固定target记录；main接收已按后续固定回执记录。

完整metadata staged diffcheck保留原始红测日志4处尾空格（node-red.log:24/31/49/56）；不清洗原日志。固定4源码diffcheck为0，非全证据无格式差异声明。

## 独立审查回执

root批准固定 `c1de71fd316f9bba1ea5f030f5a54d2332d09044`，0 blocking。实际独立22项（human-summary+task-links）全通过，1835.955417ms；读4源码和脚本、核4方hash/六scope/源码diffcheck、目视desktop light与390dark详情。未独立重跑作者browser。见[独立log](independent-tests.log)、[原始审计](independent-audit.json)、[来源hash](independent-provenance.json)及[正式review](../../../plans/wpf-dashboard-summary/review.md)。审批metadata未改源码/重测产品；main后续接收见下。

## 主线收口

2026-10-06 11:57:59 UTC 本人核固定main `017adc276a888a218bed3ef9963bc4dabbc6cec2` 的4源码与target/current/manifest全部相同；[原main回执](main-integration-receipt.json)与[本人核验](main-observation.json)分列。target不是main祖先（只读命令exit1），没有把字节相等宣称为merge ancestry。Web types exit0由Execution Lead执行，本人仅metadata收口，不重复Node/browser/产品测试。真实4320登记部署尚未采样，个人服务未动。六scope正常推送并核clean后停写，释放由manager fresh CAS办理；不预报已释放。
