# 自有组观察：一次本机结果

固定候选 `14e8fb79c51d59cf0ad7048b077ccd745a1e1ca9` 经 Lead 全文只读批准后，按 `OPS14-ZOMBIE-ONCE-0233` 唯一许可运行一次。实际入口 exit 0；内部 child exit 0 / absent / 两管道 EOF / 无监督错误；58ms，两个 case 均完成。原始输出独立保存，工具回执为忠实转录。

Darwin 25.6.0 上，leader-only 的 live → exited/unreaped → reaped 分别为 signal-zero success → EPERM(1) → ESRCH(3)。有实际活 descendant 时，三个阶段均 success，且每次 pipe ping 得 ACK。两 case 自有 leader 都已 reap；descendant 合作退出后 pipe EOF；两个 group 最后均 ESRCH。没有正向 group 信号、历史 PID 操作或剩余自有 scratch。最早错误/cleanup 字段分别保留，不能仅凭外层 exit 0 判完整。

这只证明本轮自有进程的观察，不证明任意 EPERM 等于 absent，也不将 Apple 固定 tag 当成本机内核二进制。原历史 unknown/失败不改写。

## 最小后继建议（未实施/未运行）

当前共享 `_OwnedChild.state` 已把 EPERM 记录为 unknown 并禁止信号升级；`reap_until` 对确认退出的自有 leader 回收后只读再查，只有 ESRCH 才可最终 absent。已有 Interface 明确同一规则，因此不新增 caller 特判。最小下一片为 shared 的一个 pre-reap EPERM → own reap → ESRCH 定向回归，原永久 EPERM/真实权限不足/活 descendant/逃逸边界断言保留；若实际 X01 绑定的模块已相同，先由其 owner 定位提前失败判据，不据此推定产品修复位置。

SVC05H childPidOnly 的 detached 用户服务保护不改。SVC07 后继若尚未薄接，沿原统一 Module 接入提案处理，不复制回收循环。本次不执行两 consumer 或另起探针。
