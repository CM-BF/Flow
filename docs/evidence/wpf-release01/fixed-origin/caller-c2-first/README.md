# RELEASE01 c2 首次实际：FAILED / 启动前失败

固定 owner1e5f、source9658、parent3a9d/worker5800。唯一实际11:44:11.655199Z→11:44:12.064497Z，outer exit1；sandbox-exec exit65，在Node启动前拒绝sandbox.sb第9行的具体host规则。worker.log原始145B，Node/fixture/Chrome/DB未进入，不把parent pg:1配置声明当实际创建。

outer409.297943ms、late160.985375ms、parent160.703417ms，保守410ms；一次180s段FAILED/CLOSED，未用179590ms不自动转后继。唯一terminal与result/budget/rawmanifest三hash匹配；outer双EOF480B，worker双EOF/drop0。所有原始结果逐字归档，parent fixtureCleanup=UNKNOWN_OR_FAILED原样保留，不能伪造normalDROP或Chrome清理。

11:44:37.704Z实际复核31447/31807 PID+PGID均ESRCH；exact创建scratch dev16777234/ino124103023已删除；唯一admin input dev16777234/ino124103009按身份删除且不存在，无值归档。自身资源已归还，不保有PG/Chrome/local或待launch。

[索引](index.json)列21原件/hash与缺失报告；生成的sandbox.sb为真实非metadata证据，不更名/隐藏，不冒作者独审。c2集中源码/native准备审批保历史，其不构成本次行为通过。最窄后继先固定sandbox host语法修正及同边界审查，再由管理安排必要检查/实际，当前不自动修、不重试、不改变旧包。
