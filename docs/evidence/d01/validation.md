# D01 验证记录

时间：2026-10-06 01:22 UTC。Owner：d01_owner / gpt-6-astra ultra。冻结基线 `eacee76fa7f1b6cc46b06b57ae68458637be4a26`；实现检查 target `9c236c5f86b197c3e262a6b197f21ba2371ab9b0`；本次后续提交仅为交付 metadata。

## 环境与命令

- Node `/opt/homebrew/opt/node@24/bin/node` = 24.20.0；无依赖安装或根 lock 变化。
- `node --test apps/execution-dashboard/test/*.test.mjs`：10/10 通过，真实输出见 [node-tests.txt](node-tests.txt)。
- `node --check apps/execution-dashboard/public/app.js` 与 `node --check apps/execution-dashboard/src/server.mjs`：通过。
- `git diff --check`：通过。
- `node apps/execution-dashboard/src/server.mjs --json`：只读真实来源 9/9 live，无解析警告；[生成快照](live-smoke.json) 是派生检查产物，不是手填状态。
- 浏览器 Playwright 来自 workspace bundled runtime；Chrome 154.0.8037.98，headless。命令见下，结果 [browser-checks.json](browser-checks.json)：6组通过，0页面错误。

```sh
PLAYWRIGHT_MODULE=/Users/citrine/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' /opt/homebrew/opt/node@24/bin/node apps/execution-dashboard/test/browser-check.mjs
```

## 实际覆盖

临时 Git 样本检验唯一权威 owner、相同任务旧副本不抢来源、状态改变只影响对应 task、空 review 不算 approval、历史 F00 checks 不归 feature、缺失/冻结/解析错误/重复字段与 TODO/过期与未来时间、工作树及分支切换、main HEAD不同后待同步、review SHA改变后待复审、绝对/编码/越界/未引用路径、同树及跨树 symlink、Host白名单、只读方法、CSP/文本类型/2MiB 限制。样本自动清理，不修改其他 owner 的任何记录。

浏览器检查：真实5工作线，浅深切换及持久化，390px无横向页面溢出，减少动画偏好，键盘Enter打开详情、status按需查看、Esc关闭并返回原焦点；首次请求失败后筛选不崩溃并可恢复；临时样本script/HTML在首页与资料视图都不执行。

## 截图

- [浅色桌面](dashboard-light.png)
- [深色桌面](dashboard-dark.png)
- [浅色 390px](dashboard-light-narrow.png)
- [深色 390px](dashboard-dark-narrow.png)

截图是真实 worktree 某时刻只读观察，其他 owners 持续更新，不能把截图中的旧状态当最终状态。截图时间及环境见 browser JSON。页面可继续刷新。

## 失败与修复

首轮 Host 测试失败是 Node fetch 不允许覆盖 Host；换用内置 http 客户端后验证403通过。首次浏览器脚本使用不稳定“显示”label定位超时；补明确可访问名称后重跑通过。补充历史检查徽标断言时，固定未来样本时间触发“待同步”，因此该断言失败；浏览器样本改用实际当前 UTC，重跑验证历史检查不会成为当前通过。未删除这些失败事实；最终产物只保存最新检查。

## 未验证与限制

- 协调者独立 review 对 `9c236c5f86b197c3e262a6b197f21ba2371ab9b0` 已通过，记录在 `plans/d01-execution-dashboard/review.md`；不代表 main 集成或产品中心端到端通过。
- 只测 Chrome headless；未做 Safari/Firefox、实际屏幕阅读器人工验收、多用户远程部署、恶意本地并发文件系统替换压力测试。
- 保守解析既有 Markdown表格；未识别的检查/审查字段显示未知，不做语义猜测。超过24h显示待核实，阈值可在登记调整。
- 首页风险和下一步使用 owner 原文摘要；旧 owner 记录的旧风险仍可能出现，资料下钻保留完整原文。
- 浅深、窄屏检查符合 D01；W01 的产品 UI 行为独立交付。

技能与阶段 clean-code：[quality.md](quality.md)。

2026-10-06 01:25 UTC：预览4320已从owner持有的server session重启，加载实现target所有模块；重新聚合真实9源与自身交付状态，未改其他owner记录。

2026-10-06 01:26 UTC：最终真实只读同步 W01、D01 均4/4，来源分别 m1-web / execution-dashboard，无解析警告；独立review当时与实现HEAD一致。随后的交付metadata不自动继承review，页面会保留目标SHA并提示待复审。
