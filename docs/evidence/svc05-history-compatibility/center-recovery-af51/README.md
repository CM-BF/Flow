# af51 / v18 中心恢复准备

本片只恢复原中心进程。当前中心停止，原 runner、Web、身份和用户数据保留。**实际恢复 NOT_RUN；没有 authorization.json。** 新许可和 Lead 固定 source-window 后才能执行，旧 362/v15 许可不可复用。

## 固定接口与实际差异

- 目标源 `af51c621696230fbced12227670f014ca73bd8a1`，原 runner accepting/v18，Web d629/v3。只替换 `state.processes.center`；不注册 runner、不创建任务、不发布页面、不修改维护状态/profile/token/DB。
- `facts.mjs` 复用旧只读观察：0600 私有文件、原 marker/正式 runner、全库未完/uncertain/queue、64 表与27迁移、三个 retained 产物和精确 af51 报告。只导出身份与摘要，不保存正文/凭据。新增 `maintenance_updated_at` 与 raw/protected 双摘要；只有 `conversations.queue_checked_at` 排除于保护摘要，原 raw_digest 始终保存，其余旧列全保护。
- `operator.mjs` 复用已有 load/read/save/lock/assertMarker、spawnOwnedProcess、internal-service center。旧 target362→af51、maintenance15→18、新 baseline/bindings、上述明确比较例外；没有复制新启动状态机或退役语义。
- `supervise.py` 调用独立固定 OPS14 已审 SVC consumer，再由其调用共享模块。authority 为 `owned-process-supervision` 固定47e2508a；模块不依赖随后将detach的root main。Python3.13.3和Node24.20.0均固定真实路径/字节。仅 operator PID 受截止和输出限制，detached 个人服务组不收信号。

## 入口与守卫

未来执行入口：`PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 docs/evidence/svc05-history-compatibility/center-recovery-af51/supervise.py --execute-center-once`，cwd为本权威tree。新 `authorization.json` 必须绑定 baseline/runtime-bindings SHA、新唯一 approvalId/有效期。`authorization-template.json` 的null字段不可执行。

顺序：独占新run目录及持久reservation → root精确clean af51与固定依赖 → 原operation.lock → marker及一次fresh全部读 → 与本次基线严格比较 → 持久spawn intent → 一次原center spawn（先保存pending record）→ checkpoint → owned listener及最长10秒health → fresh保留checkpoint → result。没有用户tab动作。

| 结果 | 行为 |
| --- | --- |
| 源/身份/新工作/依赖/数据与基线不符 | 停在spawn前，保失败证据 |
| spawn或随后health/保留未知 | 只记录已观察center状态，不再spawn、不rollback、不停runner/Web |
| operator截止或输出失败 | OPS14仅结束operator；新旧服务及锁可能仍在，保unknown，交Lead判定 |
| ready | 八组保留checks全部true，先持久结果再交Lead恢复checkout |

operator工作28秒+退出观察2秒、输出64KiB；该期限不依赖operator持久化返回。外层最后输出由调用工具保留；不把stdout写成功当信号前提。DB读取最多100表/每表10000行摘要，任务/未完/uncertain各1000，单连接只读RR，statement3秒/query4秒。预算是本恢复小入口，未运行产品测试/浏览器/provider。

## 原始准备事实和限制

`facts-before.json` 23:38:28：af51 runtime/v18、4终态任务、0未完/uncertain/queued、center stopped、runner/Web running；当时root实际为clean b178主线，**未声称已固定af51**。原现场state/config/profile/maintenance/release、三个retained及兼容报告与已发布19快照相等，比较见 `historical-boundary.json`。旧after不是新准入；执行前fresh原锁内严格核验。

首次系统Python3.9在模块声明时拒绝3.10联合类型，0child/0SQL/0服务动作，原回执 `baseline-attempt1.json` 保留。Lead允许现装Python3.13后，一次只读facts子进程exit0/577ms/198B、owned absent：`baseline-supervision.json`。未把该准备读当恢复成功。

本次skills沿既有本地 find-skills → clean-code/codebase-design（固定现装版本，无安装）：沿成熟host与OPS14 seam作最小适配；检查单职责、错误保留和一次性操作，个人执行等待独审/新窗口。历史operator/许可/源与原raw不改。
