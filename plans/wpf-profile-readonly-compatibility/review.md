# WPF-PROFILEC02 独立审查

状态：NOT_STARTED

- Review target commit：UNKNOWN
- Base commit：4015c667f1e2b833755b2fda6ed205fb951ec576
- Worktree：/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-profile-readonly-compatibility；branch codex/web-profile-readonly-compatibility。
- Scope：selection.ts 的 configuredSelection 形参；现专测只读复用。

## 可复制任务

只读核 fixed target、base、dirty 及 exact scope。确认唯一产品变化为 Immutable<DirectoryProfile>，不增加 any/cast、放宽运行校验或修改 shared45 输入。核现实际 readonly callers、保留 runtime clone/access/controls 与普通聊天限制。读取作者定向检查及未验范围，独立结论绑定 fixed SHA。不得把本片当新消息设置 UI 完成。

## 检查与 findings

独立检查未执行，findings 未评估；作者不得自批。main 尚未接收。后续真实报告原样归档后记录审查者、日期、范围与限制。
