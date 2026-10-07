# 固定恢复产物：构建段

仅构建 `f37a3612068c7215994750574a7451ede841bcce`（tree `de843e0fda82600b4d7600c76614c9794c17e3af`）。它由原04da精确加入七个运行源形成；[组合原件](recovery-source.json)及patch保留，packages/lock/SQL无变化，无移动main的slots或plugin改动。旧cd27、7d1及全部失败原件保持。

## 可调用入口

在原backend-browser-recovery根，只有实际窗口与fresh gates通过后执行一次：

```text
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/opt/python@3.13/bin/python3.13 docs/evidence/svc06/browser-recovery/recovery-build-supervise.py --execute-fixed-recovery-build
```

薄Python只向原 `build-supervise.main` 传固定input/entry/output/argument。原CLI默认行为与已消费 `outer-report.json` 不变；新入口先exclusive mkdir0700 `recovery-build-once`，原监督装配再wx0600 `outer-report.json`，shared entry再exclusive创建 `actual-first`。任一存在/未知拒绝，不换namespace重试。没有复制OPS14或另设生命周期。

Node薄入口核原40316B输入和已有04da差量，再按path替换七个准确源断言，保留其余源、271 snapshot/7 importer、33 SQL、Node/pnpm/原离线缓存与受审builder。新archive999文件/7,863,653逻辑bytes；不将逻辑bytes冒physical测量。新runtime internal proof仍复用原固定方法，实际cold startup是下一独立门槛。

原420s work＋0.5s TERM＋2s reap、raw2MiB（OPS14 capture1MiB）、新增2,317,352,960B与live1GiB均保持。固定输入最低3,927,965,696B；实际operator还必须同时满足当前唯一队列最新完整团队floor，不能把本静态最低门槛当最新资源许可。准备观察的21:04队列floor19,201,916,928B只是历史；Q01实际归还与build唯一窗口由Lead确认。clone/install和内部导入原单段界限不放宽。

## 必要直接证据

`recovery-build-local-02.json`：真实Node加载固定派生输入与严格参数2例；真实Python旧/新入口导入、默认路径、专用parent→wx输出顺序与重复拒绝2例。Python生命周期用自有微型OPS依赖，未启动builder；161ms/698B，两组absent/双EOF，两exact空scratch删除。

首轮检查后的汇总脚本误引用 `stdout_bytes`，子报告尚未持久化；原reservation及调用错误保留于 `recovery-build-local-01-failure.json`，该轮测试/清理证据UNKNOWN不计通过，并按最大25s扣普通预算。只重取这两个直接入口证据，未重跑旧25例、构建或服务。旧实际失败/KEEP完全不动。

源码与入口独审后才申请唯一构建窗口。构建成功仍不是冷启动或恢复批准：还需新artifact真实默认三角色/初始化正证据/闭合自有资源，以及新source/context四App兼容。随后才按受审held-target接口、原同operation23有限续接，不重放bootstrap/原迁入；无自然领取证据时actualClaim仍NO_ASSIGNMENT_OBSERVED。
