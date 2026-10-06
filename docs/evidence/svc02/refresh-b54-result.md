# SVC02 b54 更新：ready-paused

2026-10-06 07:44 UTC；操作 owner assignment_review / gpt-6-astra。GO 窗口 SVC02-b54-0736（经 Lead 转录 EXECUTE 与 QUIET_RELEASE）；本次仅安装更新，没有模型调用、用户 tab 刷新或 resume。

实际主目录固定 **b54de1dbb08e3ccc7d33a27295a318f2799e76ae** clean，产品范围与已审 253b 零差异；原维护实现 9aa 不变。07:37 先因实际主目录缺三个运行依赖在 drain 前停止，原失败保留。Lead 按已审锁离线 frozen/ignore-scripts 安装，reused91/downloaded0、manifest/lock 未变、三包 exact version 从实际 main 解析并加载；随后明确交回原窗口。没有借全局 npm 或 feature 树。

## 操作与当前状态

| 时点 UTC | 实际行为 | 结果 |
| --- | --- | --- |
| 07:38:47 | fresh 全库/身份/部署/配置核验 | 2 succeeded、2 completed attempt；未完/uncertain 0；唯一原 runner accepting v3 |
| 07:39:01 | 原工具 bootstrap | exit0，draining v4 |
| 07:39:13 | fresh 全库、原进程和身份核验 | 未完/uncertain 0，原记录摘要相同 |
| 07:39:18–21 | 原工具 refresh b54 | exit0，hold maintenance v5，ready-paused；迁移 1..16 → 1..23 |
| 07:39:47 | fresh 启动、DB、配置保留核验 | 三个 owned 组运行、监听/健康通过；sourceAtStart b54 clean |
| 07:40:25 | 只读精确旧字段摘要解释 | 固定新增列全 NULL，原字段摘要相同；同 operation 只有 drain→hold |

operation `22adf2ed-3ae1-4e51-8247-3f14776ac8f1`；runner `d22f4df2-8242-49f4-a1b4-77f8f08611ef`；profile `7ed454e9-f1db-420c-ac7f-4aa53f3856c0`，均保留。新 owned PID=PGID：center95468 / runner1776 / web1974，实际 cwd 为 main；监听仍61227/61228。只操作本次安装的原 owned 进程，未强杀。配置/native 配置完整字节哈希不变、native 目录 dev/inode 不变、私有文件0600和目录0700、DB marker/runner credential 身份核验通过；凭据与用户正文未输出。

## 数据保留：原失败不改写

[首次完整行摘要检查](refresh-b54-preservation-checks.json) 的 `passed:false` **保留原样**。五表 attempts/sessions/artifacts/details/execution_profiles 的前后完整行摘要与 ID 集合相同。四表 tasks/conversations/conversation_turns/conversation_queue 的完整行 JSON 增加 nullable key，故摘要不同，计数和 ID 未变化。

固定 b54 的实际迁移逐项解释如下；没有用动态“共同列交集”排除可能变化的旧列：

| 表 | 仅新增且实存全 NULL 的列 | 固定迁移位置 |
| --- | --- | --- |
| flow.tasks | conversation_input_id | 018-conversation-context.sql:21 |
| flow.tasks | goal_input_id | 021-goal-context.sql:23 |
| flow.conversations | project_id | 018-conversation-context.sql:1 |
| flow.conversation_queue | conversation_input_id | 018-conversation-context.sql:22 |
| flow.conversation_turns | conversation_input_id | 018-conversation-context.sql:23 |

018/021 没有 UPDATE 数据回填语句；以上 ALTER ADD 无非空默认值。17/19 是相关 actor/mode 约束扩展，20/22/23 建立新领域表，不通过改写上述旧正文完成升级。原 1..16 已应用；本次实际生产初始化仅前进到23，不执行24。本次没有额外迁移、数据修复或回填凑绿。

[精确旧字段核验](refresh-b54-old-column-preservation.json) 对每行 `to_jsonb(row)` 仅减去上表五种新增列后，在 PG 内重新求序列化 MD5，和 pre-drain 全行摘要及身份一一比较，四表全部相同；所有这些新增列非 NULL 行数为0。**唯一预先排除项**是 conversations.queue_checked_at（既有后台扫描时间），前后采样都已排除，未保留原值，不能宣称其逐值相等。除此以外的既有字段全参与对应逐行摘要；未保存正文/凭据原文副本，因此准确结论是“每行全部既有字段的序列化摘要相同”，不是事后伪造逐字段明文副本。MD5 是操作核验摘要而非抗恶意碰撞证明。

完整身份集合见 [retained-identities](refresh-b54-retained-identities.json)，所有原始每行摘要及关联 ID 均在 pre-drain/after-refresh 原始 facts，正文不入证据。表行数：tasks2、attempts2、sessions1、artifacts2、details12、conversations1、conversation_turns2、conversation_queue1、execution_profiles1；无截断（均低于2000限额）。

## 范围与下一步

单 runner 依据是本安装已知部署记录、正式注册/凭据身份、完整全库未完快照，以及本机实际 owned 进程；不是跨所有未知主机的存在性证明。ready-paused 只说明本机安装/数据核验，不证明 provider 可用、UI 浏览器实观、真实聊天、npm 包安装/加载或多 runner 更新能力。X05 可选 host 未启用。0新 query，0工程测试重跑。

**现在仍 maintenance v5，resume 未授权。** 等 GO 对固定证据明确 resume 后，按方案仅一次 fresh 身份/原 source/operation/全库未完核验，再用已审工具恢复；任何 active/unknown/身份变化停报，失败保持暂停，不自动回退。原配置/数据不回滚，不将关连接当任务停止。
