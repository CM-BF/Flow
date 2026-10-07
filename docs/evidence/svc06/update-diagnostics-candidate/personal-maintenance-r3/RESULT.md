# 剩余维护R3：只读兼容门失败

2026-10-07T13:05:06.328778Z reservation → 13:05:06.750720Z stop。最早facts-before返回 `WEB_COMPATIBILITY_INVALID`，418ms/exit1；整个operator494ms/exit1。PID97738与97737分别absent/双EOF/无signals，已即时归还窗口。完成阶段为空，bootstrap/refresh/checkpoint/resume均NOT_RUN；R2四阶段没有重放。

固定旧facts相对导入旧Web reader（仅format1），扫描兼容目录时遇已在R2导入的C3 format2报告后拒绝。原C3 caa1 791B/hash16544…与保存导入回执匹配；其6c/context81a8不能由旧af51 reader读取。错误在Pool构造前，0产品SQL；facts此前已有个人只读访问，因此不称0个人读取。完整snapshot未形成。无个人状态写入、服务动作或provider。

本次证明观察入口版本不兼容，不证明真实App不兼容。旧pointer/af51报告保留与新backend6c+policy/C3运行资格必须分开核。所有失败和UNKNOWN原件KEEP；不得自动重试、清目录、回滚或重放R2。独立结果审查待Lead。
