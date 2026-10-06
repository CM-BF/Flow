# ENG 集成后的 P04 待移交输入

2026-10-06T11:13:46.405Z，status_read / gpt-6-astra，只读源码/调用图；未合入主线、未修改runners或测试、未运行PG/工程测试。main `2e71fabc218df28f6ccb78a927432ae1101c17c5` clean，已含ENG集成 `221809d37754f7ccbc22a2f1288ee310b16f3461`。13个固定main来源字节/SHA见[observation](eng-inheritance-observation.json)。

- **最小FOR SHARE方案仍适用。** runners.ts 相对P04 c450基线仅claim候选SQL新增工程purpose与精确profile/project/base/checker过滤（main行52–60）；lockRunner/ownedAttempt及heartbeat/revoke未变。只在合法移交后改ownedAttempt私有授权读取点，不改此已审SQL。
- **锁顺序未新增升级。** 新 `execution-profiles/publication.ts` 把原profile发布事务集中为 `publishConfiguration`，仍先runner FOR UPDATE，再读取/插入immutable profile；native/engineering publication均走该Interface。`requirePublishedProfile`仅SELECT，不在ownedAttempt共享路径再获取强runner锁。`assertTaskExecutionProfile→assertEngineeringProfile→requirePublishedProfile`新增purpose校验；claim调用时已持runner独占。没有新ownedAttempt caller。
- **既有强锁代表不变。** events、maintenance、goal runner-project fence、protocol recover、active-steering两入口、reconciliation和016触发器逐字=c450。goal/protocol仍先外层runner独占，claim/INSERT attempt仍先独占，drain/hold与revoke差别不变。
- **9项fixture无需语义变更。** fixture任务没有engineering/profile；新SQL普通分支在rp缺省时仍接受，A2A及fixture goal授予使用相同既有路径。两nested强锁检查、同/不同attempt、revoke queued-read、drain/hold/容量/expiry检查仍针对真实生产Interface。createServer新增工程route注册无迁移或后台worker；bootstrap close后做锁实验的资源前提不变。此为静态判断，未把旧red/strict声明成新基线green。
- **直接消费者与继承核验。** 新publication/helper和engineering profile应加入最终readonly绑定及strict传递图；合入时必须保留ENG claim选择SQL逐字不变。最小额外回归候选为既有独占随机库 `apps/server/src/engineering/profile.test.ts` 的 `filters unpinned historical rows and other purposes before claim without blocking legitimate work`；是否在最终集成点选跑由Lead按已审ENG证据与实际差异确定。本段未执行，也不要求重跑ENG全套。

写权仍由fresh账本决定：ENG01B claim `172ae2c2-8910-4bc8-bca3-53d797da175b` v2 ACTIVE含runners.ts；P04 cb7db4a9 v1只有原三scope。main集成不是路径交回。待原owner明确停写→amend移除→P04 fresh amend成功→继承Lead指定固定源后才能改；不得以本观察替代receipt，也不自行merge。

clean-code复核：没有为新增purpose加第二锁模块、任意lock mode或调度器；私有固定查询与事务状态归属继续清楚。原18 preparation/25 red绑定及源保持冻结；本页是后续main输入观察。
