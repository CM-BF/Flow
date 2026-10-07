# SVC09A 隔离宿主 R1：失败保留

唯一已审入口运行一次，outer 32,568ms / exit 1。克隆、全新DB marker与合成Web loader已完成；首次center就绪检查失败（`START_UNCONFIRMED_CHECK_STATUS`，内层`SERVICE_START_UNCONFIRMED`）。runner/settings/web尚未启动，两槽生命周期与mixed领取未验。0provider/个人操作/重试。

caller仅证明自身PID退出；clone/work/cleanup原组均absent、双EOF且无signals。真正登记的center86509由原helper停止，同nonce exit0/stderr0；事后exact PID/组均空，专用DB连接[]且观察pool已关闭。15:58:29.899259Z归还实际运行窗口。DB/private继续KEEP；原`mayDrop=false`、`cleanupConfirmed=false`与FAIL不改，不把未实现的8代条件当成8个活进程。

证据：`host-outer-once/outer-report.json`、`actual-host-once/`原报告/阶段记录、`host-post-failure-database.json`与`host-window-return.json`。准入时间15:56:01.614895Z与operator真实reservation15:56:17.907028Z分开。旧构建/局部结果不重跑。
