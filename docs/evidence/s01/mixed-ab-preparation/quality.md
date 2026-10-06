# S01 A/B clean-code / verification

2026-10-06 13:58:44 UTC；status_read / gpt-6-astra。

本地find-skills已读取并采用clean-code/codebase-design/brainstorming/tdd；受控来源见interface.md，无新安装。Module职责分为固定budget与顺序A/B、Git输入与依赖、薄资源编排；现有mixed保留HTTP/PG/proof/cleanup。共享parent三个Helpers无修改。命名区分预核deadline、side started、outer deadline、Node流计量与磁盘余量；同步hooks不吞掉外层预算失败。

真实pure red证明未接钩子时128次submit不进入外层计数；19新pure/fake和42旧direct共61distinct在两轮最终选择覆盖，不是一次61绿。失败raw保留：缺钩子、fake path canonical差异、旧profile SQL fixture。最后一项仅改为A/B固定runners中真实两列SQL，不放宽observer分类、不删断言。strict0继承root基线；没有真实PG/HTTP/runner/SDK/provider或输入导出预演。

Root预读两项已修：preparation15s覆盖原clock的Git/校验/导出；side begin在异步磁盘检查前固定started，inner所有清理deadline取与outer的min，outer等待不超过该side deadline。晚操作不被当作取消，unknown保留source root并禁B。磁盘每秒单flight只读门禁，低余量停新work；PG/WAL与其他任务增长不冒称由wire预算约束。

新增代码约400行含19checks，无新产品SQL/pool/调度器/缓存；无架构/公共合同变更。当前资源是执行条件，不阻塞准备交付。A/B源raw固定后只读独审，旧128 raw/UNKNOWN、FKye9L未读取/改动。
