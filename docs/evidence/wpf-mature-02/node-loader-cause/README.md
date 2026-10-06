# 唯一加载错误观察准备包

NOT_OPEN。设计/边界见[Interface](interface.md)，角色字典[dependency-roles.json](dependency-roles.json)，检查[checks/result.json](checks/result.json)。固定源码、input/manifest获独审及Mika命名门禁后仅执行一次：

```sh
/bin/sh experiments/codex-app-server-conformance/node-loader-cause/execute-window.sh --reviewed-node-loader-cause-window
```

一个Node宿主+最多一个自有Node目标；0compile/Codex/SDK/provider/listener。与旧R06相比宿主采用detached group、无initialize、双流观测，不倒推旧原因。stdout/stderr各8192只限保存量，observedBytes计全部收到的chunk；截断、EOF/close/group未知使全输出计量FAIL/UNKNOWN。

30s覆盖加载/hash到自动证据与清理；outer-end仅宿主结束采样，outer-final是尾部写入前采样，真正末次门禁在所有自动write/close/count之后。shell实际退出仍必须由外部tool完成回执确认≤30s，否则FAIL/UNKNOWN；人工review/Git时间外、bytes计同256KiB。prepared≤80KiB、archive112KiB、机器收据CLI16KiB、outer捕获+磁盘4KiB、capture+磁盘32KiB、配置8KiB，余4KiB。archive为本目录非私有文件+当前四共享metadata实际全文；历史快照不冒称当前。原始流只在自己临时根0600/wx，受控分类后finally精确清理；outer-time.stderr仅本地0600/ignore，不打印/Git。CLI0仅完整观察，不代表Node隔离/根因/模型资格。
