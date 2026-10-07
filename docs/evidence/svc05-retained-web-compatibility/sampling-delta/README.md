# 有限采样与异常保留修复

源码目标 `b41ae1a7dc478fcb2de4e15bcbb0a27273c61c16`。只改 fixture/browser，页面5s断言、真实两App顺序/原key显式恢复/cleanup规则未弱化。原两次raw永久保持失败。

diskBytes 固定root dev/ino，仅对已列出的child在lstat时ENOENT最多2次fresh重采；250ms共同deadline和累计file-count不重置。根/被遍历目录消失、身份变化、权限、越界或持续churn均拒绝；结果显式nonAtomic及重采观测。Chrome合法leaf link仅计lstat自身，不跟随或声称目标被计入；root/目录symlink拒绝。异步只读文件调用受逻辑deadline等待限制，不能称OS取消或原子快照。

runPreviewWithCleanup 返回原工作异常和额外cleanup异常；实际worker分别记录/优先保留工作异常。不推断历史6个Preview错误全部由cleanup引起。

`checks.test.mjs` 9个纯小用例覆盖实际可控rename、持续churn、root替换/失踪、权限、目录消失、link/目录替换、累计count/路径越界、共享deadline和两异常保留。原scope仅新增own evidence中的test，无PG/Chrome/provider。

**NOT_RUN**：前置资源检查在reservation/临时目录/Node测试进程前退出，后续只读free观察827,797,504B低于1GiB+8MiB。原preflight错误保留，未自动重试或清其他资源。剩余真实旅程预算候选72,188ms并非运行授权；当前没有新PG/Chrome窗口。
