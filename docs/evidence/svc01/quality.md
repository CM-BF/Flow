# SVC01 方法与范围

2026-10-06 04:10 UTC，Astra Ultra。按find-skills本地优先发现Node进程/配置/CLI模块任务，读取已有codebase-design、clean-code、brainstorming。Root已明确批准最小常驻方案，使用start/status/stop窄接口隐藏持有校验与进程身份，不重造中心。无额外技能安装/模型调用。检查重点是失败清理、命名、私密配置、进程归属和可复现接口行为，不机械拆函数。

工作段与交付/合并前记录检查；未运行检查不写通过。claim回执在/tmp/flow-svc01-receipt.json，04:09:25 UTC成功后才创建本计划。main基线8f1481固定。常驻服务尚未启动。

2026-10-06 04:16 UTC runner_owner/Astra已核clean b624fa5与handoff_pending v2，accept获得v3后才写；受控合入main6c9b098含R04。Node/CLI/PG进程管理使用本地find-skills方法；本工作段重新实际读用codebase-design、clean-code、tdd，固定clean-code来源不重装。已有技能覆盖接口/资源生命周期，采用已授权start/status/stop公开seam与真实临时进程/专库测试，不扩通用进程平台。

## 2026-10-06 04:29 UTC 实现与检查

本片段通过 `start/status/stop --directory` 隐藏私有文件、随机PG库与进程归属；实际public CLI和导出seam均有验证。没有新增依赖/rootlock修改，合入的依赖锁仅来自已审main dd1b9dafc77fb56a580d3d41dc7ddec3b1996ef8，pnpm frozen安装通过。

[最终输出](behavior-tests.txt)：Node7/7，15.257秒。第一项从独立CLI启动，CLI已退出后实际server/main + runner/main + Vite仍可status/stop；center已持久接受配置profile，但work.total=0，不触发SDK query。第二项拒绝扩工具配置/宽权限/不同DB地址；第三项通过公开HTTP提交未被Claude runner支持的fixture待办，停止后无确认拒重启、确认后保留同一任务（仍无模型）；其余覆盖marker身份、已有目录拒绝、外部监听者无owner认证/无停止、旧进程身份拒停、忽略TERM时限返回unknown。随机专库与目录逐项验证marker后DROP/删除，只停止已记录的自有组，不使用flow_c01/flow_i01/固定端口。

[process红例](process-red.txt)与[preview红例](preview-red.txt)记录新公开接口缺失，随后逐段实现。最终源码在已审三端/R04基线上运行；没有真实provider请求、SDK/共享登录凭据读取、登录修改或用户常驻部署。子进程输出丢弃；只写0600私有config/state/manifest与固定exit事实文件，不把测试密钥放入项目。

clean-code工作段/交付复核：处理了postgres URL.origin为null不能用来比连接身份的问题（改显式protocol/hostname/port/user比较）；发送owner令牌前核监听归属；持久保存待确认spawn身份；内部child需state中PID/nonce匹配；state放置前拒Git工作树，操作锁不超时抢占。职责分为小CLI、个人预览生命周期、进程身份helper；没有自动调度/自动修复/通用服务框架。未知与失败保留，不冒称provider在线或任务完成。

剩余限制：macOS/POSIX本机合作持有，非OS强隔离；启动失败可能需要人工核查私有state/operation.lock，不自动删除未知资源；TERM超时不强杀，外部副作用仍按中心uncertain处理。旧来源历史日志未改；当前日志仅规范末尾多余空行以通过diffcheck。实际产品URL与浏览器/真实聊天验收归Lead，SVC01-03/04仍pending。架构接口说明见tools README，Lead接收target后同步工程dashboard固定拓扑。

2026-10-06 04:31:53 UTC 固定实现 `0b5b3fec1bed2c86b0493c48e4d39e77741828ad`。源码与最终7/7被测内容一致；此后仅metadata绑定目标。交付前本地链接5文件、diffcheck通过；只读PG统计flow_preview_*剩余数据库0（不删除未知库）。独立review保持NOT_STARTED，D04 claim v3保留待修复。

## 2026-10-06 04:33:28 UTC review P2修复

Execution Lead指出初版继承process.env会传播管理凭据。已用environment模块集中系统/provider允许清单，wrapper先过滤，实际role再仅注入所需Flow变量；Web无DB/owner/runner/provider认证，runner无管理/owner认证。新增纯合成环境marker真实子进程检查，未读取/打印共享认证。红例[environment-red.txt](environment-red.txt)；最终[review-fix-tests.txt](review-fix-tests.txt)8/8，15.496s，0模型。原7/7不冒充修复后证据。clean-code复核接口集中、role配置无重复，失败仍固定脱敏；runner内部SDK环境边界由Lead另行处理，用户服务仍未启动。
