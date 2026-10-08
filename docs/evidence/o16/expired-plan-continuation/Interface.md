# 过期提案的新阶段接续（仅实现准备）

2026-10-08T01:58:09.247Z 开始；原三scope。选择经 GO 明示的新阶段合同，替代前一文档01:54的未实施“有效期内改source”草案。本段只源码/自有合成材料，未读旧private、未连PG、0模型/认证/实际confirmation。

`operator --renew <新run> <新阶段grant>` 复用原150秒总监督与120秒工作/30秒收尾；不新增运行器。grant固定新source/env、旧pause/state/report/resources/directory/DB身份、实验源exact before/after delta、真实confirmation两节点/profile/版本、独立新期限和GO授权引用。确认仍0query；新children许可必须在真实confirmation后绑定其digest/progressionId，最多2次/各3turn/USD0.10/60秒，原父总时限不延长。费用是SDK估价，账户账单未知。

| Module | Interface / 状态所有权与失败 |
| --- | --- |
| continuation.mjs | 新合同只接受已过期、明确成功且未消费的原plan。按原关闭时刻重建档案真实性，但不调用旧validatePause来接受过期。exactdelta逆算整个旧identity，任何未列源码/依赖漂移拒绝。读取原pause/report/resources/state和只读material；不改它们。 |
| reserveContinuation | 先复用旧run原`pause-consumed-plan.json`的wx权威，与任何旧entry互斥；再按旧pause摘要写单份新阶段reservation。不同新run/approval不能重复占原来源。部分写/同步失败保留消费/UNKNOWN，不清除、不自动再试。旧namespace只新增消费标记，不替换旧文件。 |
| verifyContinuationDatabase | 实际SQL端口：max1连接、原2s连接/5s语句/6s查询上限、repeatable-read只读事务。核真实goal原始摘要、project revision、唯一proposal完整input/source、全库无application/confirmation/progression/execution、唯一成功且已验证planner和完成attempt、两个profile/current accepting runner、固定知识版本。拒任何未知/新增执行。查询结束COMMIT或ROLLBACK/release/pool.end；开server前再次核。单独快照不是永久全局排他，实际调度仍需唯一writer/无其它consumer窗口。 |
| resources.mjs | 保旧DB/marker并新建独立private目录与新journey/intents，只新state记录newsource/connection/origin。旧material实际绝对路径保持以保profile不变；无material重写/软链接。旧合成Flow owner token经原reader在内存复用，不复制native认证凭据；新journey保原合成runner身份。只有原directory dev/ino、marker、无连接及fresh全符才可start(false)。 |
| driver / 原确认模块 | 明确renew消费后调用同一confirmAt，持久确认intent/key后才发真实原CAS。默认confirm仍原validatePause/source/15min语义。新pause只由真实confirmation和完整关闭生成，绑定新state/newsource及旧origin，next=children。任何未知保原错误、没有query重投。 |
| permit / 原query循环 | 仅validated WeakSet/v2、精确source/env、实际confirmation、模型/额度/期限全符时接children；JSON登录/订阅声明无权。原两slot、每实际task一次、assignment与权限核验不变。 |
| 最终独立接受与清理 | adopted阶段必须KEEP旧DB和两private目录；接受仍要求独立actor/实际artifact绑定，不能自动获得旧资源DROP权。stagePassed对这显式retention仅承认已接受且资源关闭/保留，普通原decide仍要原正常DROP/目录清理。后继实际清理另明确授权，不在本片。

旧pause已过期仍被旧入口拒绝；新授权不修改旧digest/time/state/raw。原4query永久封存，当前没有新grant/permit；GO的proposal语义接受不冒confirmation签发或children预算。原76a9结果独审/main254ce9579单份引用，完整验收仍open。

验证只用显式continuation.test.mjs/`^continuation:`及必要原入口直接例，0PG/服务/provider，最多4受监督children/累计120秒、单30秒含收尾、tmp8MiB。测试原件与source pin同一份。实际动态SQL未跑PG、旧来源的后续实际读取/新阶段确认尚未运行。必须源码独审后再给GO精确新grant与2query预算候选，再由D01安排真实资源窗口。

方法：沿已安装find-skills发现本地codebase-design、clean-code、brainstorming；复用现有模块/错误与生命周期权威，不安装新依赖。安全点复核责任/命名/原首错/重复/边界；保留外部授权与真实证据区别。
