# R4：已进入 drain，本地 admission 门停止

唯一窗口 `svc06-personal-7d1-20261007-1320`，固定491/c51，原R2四阶段不重放。实际13:19:32.771546Z开始，13:19:54.167135Z停止；operator21477ms/exit1。

已完成 facts-before、preflight、history-before、root bootstrap。首次完整facts确认旧af51/accepting18及原64表摘要、5任务状态和三owned身份保持；新6c/C3 tuple独立校验成功。bootstrap实际返回 draining/v19、operation `e6550b3c-1f67-4c2c-869d-e84d5e838113`、active0/uncertain0/stopPermittedfalse。没有调用hold。

下一 operation 原stdout为空，stderr仅 `RUNNER_ADMISSION_NOT_IDLE`。最早拒绝在原reader对admission严格v1 idle判断；尚未到完整历史文件/hash比对。实际payload/附带runnerObservation未被原caller持久，无法区分非空项、版本或其它严格字段不符；不猜根因、不放宽门禁。

refresh/paused checkpoint/resume/final均未启动，后台未切新版本。operation在localIdle之前已通过真实op/drain、旧state.backendArtifact null、三owned running和一次同值status校验；这是代码控制流事实，非停止后完整现场采样。drain已产生实际效果，不能重放bootstrap、不能将其当未调用或自动恢复。

operator和5个阶段的直属PID均absent/双EOF/signals[]，没有pending invocation；已经报告Lead归还运行窗口。这里不声称个人三服务组消失或停止。全部原件保留，0provider，无自动重试/rollback/cancel/clear，也未追加个人probe。R3FAIL/旧KEEP保留。完整状态、时间和原件绑定见result-analysis/result-manifest。
