# 后继真实宿主：仅实验内的受信任启动接缝

原 e6ff FAIL 与 f46a 清理结果不改。固定 e5 产物及其原 process/runService/nonce/stop 逻辑保持原字节，不重建、不装依赖、不声称默认产品部署已使用本接缝。

Module 仅承担这一次实验的进程隔离与有界私有诊断：可信工作 observer 和原 spawnOwnedProcess 在 profile 外；一个同 PID 的自有 bootstrap 先安装严格单次 child_process.spawn 参数变换，再在同进程导入 e5 原 CLI/internal-service。原 runService 的 state.pid===process.pid 与 nonce 检查实际运行，不新增代理 PID 或复制等待/停止循环。

Interface：固定 role 的唯一 expected program/argv/cwd + 固定拒读 profile + 私有日志目录。只有原 runService 发出的一个精确 Node spawn 可被变换：program 改为 sandbox-exec -f profile Node，原 argv/cwd/env逐值转发，detached仍不增加；原 stdio ignore 改为有限私有 stdout/stderr 捕获。配置只由固定 harness生成，不提供任意命令入口；不做全局通用spawn框架。所有其他形状拒绝，不回退为未隔离执行。三个role的固定形状由一张本实验表生成，其他层不散播角色条件。

实际 server/runner/Web 及后继子进程在 profile 内，仍拒读四条开发路径及realpath别名；原宿主CLI/ps、观察器、证据写者在外。bootstrap只保存脱敏启动参数摘要；stderr原字节仅0600私有文件，有界截断明确记录bytes/overflow，不公开用户内容或凭据。原stopOwnedProcess仍按完整 PID/PGID/nonce记录对同组一次正常停止。

先做无PG小验证：可信wrapper原identity/stop可工作、真实子进程/孙进程开发路径读取拒绝、超额stderr有限保存、参数不符无spawn。局部累计≤90s/临时8MiB，0PG/Chrome/provider；不将toy当三角色验收。固定后一次独审，真实PG后继仍需共享窗口。

待固定真实旅程的私有状态布局：verifyBackendArtifact要求 installation/backend-artifacts 为真实私有目录，不能用指向原e5的外部symlink伪装新安装。现原root已有必须保留的config/state字节和raw。后继应先明确是保存原件后受控复用同自有root，还是独立CoW复制同e5（不构建/不安装）；不能在实现中静默覆盖原记录或改manifest路径。此取舍不阻碍上述纯局部接缝验证，但真实旅程固定前必须解决。
