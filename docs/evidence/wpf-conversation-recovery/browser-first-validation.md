# 首次真实浏览器子集 — FAILED，原始证据保留

记录 2026-10-06T18:02:45.702877+00:00。执行 HEAD `0fe939fa222e69993ebaca825c6ca6bf0ea683fd`，browser667 / fixture768 / 其余17源1b8；19hash已与fixed/current/run逐项核。[manifest](browser-first-manifest.json)、[准入](browser-first-admission.json)、[gate](browser-first-gate.json)。配置只用manager显式隔离admin；未读取或归档凭据内容。

一次运行从 `2026-10-06T18:00:49.485Z` 开始，exit1，总 `14846.267375`ms；原总90s中预留15s清理，累计同该值，余 `75153.732625`ms仅算术，无续跑许可。[budget](browser-runs/rec667-20261006-180030-f86542/budget.json) 和 [supervisor](browser-runs/rec667-20261006-180030-f86542/supervisor.json) 原样保留。

- cookieRead通过：实际浏览器保存HttpOnly cookie，并通过公开cookie-only session GET打开原中心。
- textIntentDraft失败：5秒predicate timeout；pageErrors记录 `Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.`。这是当前观察，尚未定性为产品或harness根因。
- materialDraft未完成；sameKeyTurn/crossTabCas/pageOnlyAuthLoss/CSRF/offline/390主题均未运行；SSE delivery、CREATE两阶段、Queue/Steer、完整knowledge/profile/steering稿及secondcenter仍PENDING。
- [browser原报](browser-runs/rec667-20261006-180030-f86542/browser.json) 与 [process原log](browser-runs/rec667-20261006-180030-f86542/process.log) 不删失败、不回填PASS；旧受控27绿不代表真实IDB通过。

清理：ownedDB remaining=[] / connections=0 / removed=true，两次观察均零；worker25550与Chrome25768 exit0，自有process groups未留；scratchRemoved=true，cleanupErrors=[]，budget.complete/cleanupComplete=true。实际使用一个隔离DB、一Chrome，无provider/个人服务。保留10raw共17415B，日志8025B；250ms样本scratch最高27540779B、free最低1694044160B，非物理硬峰值/非本进程独占归因。过程已交manager归还窗口并由其删除临时admin文件。

完整feature review NOT_STARTED / target UNKNOWN。三中心语义不阻本次获准same-origin子集，但仍为完整目标未闭合项。下一步只能先依据原raw定位，再经明确后续修复/运行派工，不自动重试或扩大旅程。当前19源保持冻结。
