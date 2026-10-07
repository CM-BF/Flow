# 两个真实 consumer 的最窄后继版本提案

仅只读提案，2026-10-06。当前模块 source3097730 已 main78fb3770；两旧 wrapper / fixed 运行候选原文均未改。下一版本应由各 owner 在待运行候选封存后，于独立后继 source-only worktree 接同一路径的新版本；不创建一份长期并行 wrapper，不借本 claim 写其他任务。

## 1. 小 Module 的一个真实差异

两个真实调用者需要两种 pipe 形状。新增有限 `Capture.SEPARATE`（默认，保持现 Launch 四项调用）与 `Capture.MERGED`（Popen stderr=STDOUT）；只改 Launch / Report 中明确 mode 与实际 pipe 集合，不增加 callback / 通用 sink。SVC07 的 stdout 与 stderr 在同一 OS pipe 合并，保留原 kernel write 顺序；不得用两个事后 bytes 简单拼接冒充旧日志。合并模式 stderr bytes 为空，mode 明确其已并入 stdout，EOF 只描述实际 pipe。总 output cap、超量停止、最早失败及所有权不变。

仅这三 literal（原 OPS14 owner 后继小片）：
- `tools/owned-process-supervision/supervise.py`
- `tools/owned-process-supervision/supervise.test.py`
- `tools/owned-process-supervision/README.md`（同时按 Lead 校正13 different分轮文字）

局部只测新 merged 正常交错输出顺序 / 64KiB合计超限 / 默认 separate 直接 consumer，不重跑13。scope / source合同冻结后才能供两个 wrapper 组合。

## 2. SVC05H：保持118+2、只operator PID

后继同路径最小2文件：
- `docs/evidence/svc05-history-compatibility/center-recovery/supervise.py`
- `docs/evidence/svc05-history-compatibility/center-recovery/supervision_test.py`

薄 adapter 保留 `supervise(argv, work_seconds=118, exit_seconds=2)`；受信固定 argv/cwd/env → `Launch(... CHILD_PID_ONLY, SEPARATE)` / `Policy(work_seconds,0,exit_seconds,65536)`。由 Report 映射原 operatorPid/operatorExit/deadlineExceeded/operatorStopped/elapsedMs/stdout/stderr/serviceSignals0，只有 exit0、无 first/secondary failure、EOF 和 child absent 才 operator-returned-zero，其余unknown。正常stdout原分流；新增64KiB有限输出是显式后继约束。停止只operator本身，即便它已spawn detached中心/runner/Web也不signal。

当前旧 operator.mjs/授权/nonce/数据库与个人安装 marker 原文不动；下一真正恢复必须由 owner 的新许可绑定新 supervisor source 和实际固定 operator，不能复投原 consumed authorization。保原2个受控调用用例，经真实薄 adapter 运行；0个人恢复/PG/provider。这一步移除旧communicate循环而不是在其外再叠一层。

## 3. SVC07：移出同步I/O，保合并日志与spawn checkpoint

后继同路径2文件 +1个 caller-owned 叶子：
- `docs/evidence/svc07/execute-pg-once.py`
- `docs/evidence/svc07/execute-pg-once.test.py`
- `docs/evidence/svc07/supervised-spawn.py`（新，仅own PID checkpoint → exec；无监督循环/DB/source权限）

删除原 supervise 的 selector/stop循环，使用共享 `NEW_CHILD_SESSION + MERGED`。现时剩余工作期限由原绝对deadline减monotonic取得；正 TERM grace / reap预算沿原0.5+0.5。固定 command/environment/source-preflight 与数据库fixture/cleanup保持caller权威，不复制进Module。

不能把同步 on_spawn fsync/log.write 搬进Module，也不能悄悄删除已承诺的spawn持久记录。选择：caller在spawn前固定本run reservation和计划checkpoint路径；受监督 child 先运行极小 `supervised-spawn.py`，只把自己的 PID / 初始 PGID / UTC / 固定run nonce以独占0600写入新 `pg-spawn.json`并同步父目录，成功后在同一PID exec 原固定 command。该checkpoint写入阻塞也在共享监督deadline内；写失败不得exec测试。它不读DB、发信号或验证source。进程身份记录是caller资源责任，故不入公共Module。

共享Report返回后再把有限merged raw写旧log并关联spawn receipt与Report.pid；日志/最后报告写盘失败另列，不覆盖firstFailure。stdout截断或EOF不完整不允许通过。旧原测试输出全部保留；新的OUTPUTS/manifest增列pg-spawn，先通过原caller的source和permission检查。

局部兼容直接测试：真实薄adapter正常顺序、超量、checkpoint pipe写卡住（不得exec workload且有界停组）、独占checkpoint失败、首失败/cleanup分离。只受控子进程，无新真实PG。既有外层“30秒”最终写盘并非本模块承诺；仍记录实际wall/unknown，不宣称新的整operator硬截止。若后继要求最终report I/O也有硬期限，由caller复用已审外层guard并另绑定，而非把阻塞callback重新放进Module。

## 领取与完成条件

以上共8个产品/验证literal，分属原Module owner、SVC05H owner、SVC07 owner；各自plan/evidence沿原权限。Lead先协调两个旧owner停写与精确amend/后继tree；共享source须fixed复用，不复制Module文件正文。已审待运行候选保持旧source+manifest，不重跑。

只有两个后继实际wrapper已固定导入同一Module、旧循环删除、各自原调用者的直接检查与独立审查完成，才关闭OPS14-04。只交本提案或受控stand-in不能称两个真实consumer已迁移；本提案不授权PG/个人恢复/模型。
