# SVC09 Interface

固定base5b0bef86；12个产品literal和own plan/evidence由claim1a2b634b v1唯一持有。复用既有preview锁、environment白名单、Web artifact校验/发布CAS，不修改后端auth规则、用户任务、SDK或调度器。

| Module | 输入/输出与所有权 | 错误、生命周期与依赖 |
| --- | --- | --- |
| browser-session-configuration | 精确安装目录的可选私有策略文件；返回规范化server选项、非秘密context与文件身份/hash | 缺失默认off；regular/nofollow/self/0600/nlink1/有界字节/安装身份；invalid与采样不明拒绝。prepare/load在任何drain/stop前读并固定；runService再核同identity/hash，读取变化不接受。 |
| environment / preview | 仅受信loader提供center browserSession；wrapper携带已验证的非秘密固定身份，child重新读取核对 | 继承FLOW_BROWSER_SESSION_JSON和任何策略注入值被丢弃；runner/provider环境原语义保持。无新token/config复制、无产品外env绕过。现锁正常finally释放，unknown不声称锁永久留存。 |
| web-retention-policy | 一个不可由请求提高的固定表：4 artifact、192MiB声明资产、32 committed reports；现单体/文件边界保持 | read/plan/load/import统一使用，不散布魔数；原3项全保留，第5/count/bytes/report不足拒绝，不TTL/pagehide回收。 |
| web-release / static-web | 新versioned report携带normalized publicOrigin +非secret browser policy digest；四check原件同context；实际受信expectedContext贯穿verify/find/plan/load | 旧format1只在legacy未配置路径可读，绝不当新configured兼容证明。语义同一context方可复用旧报告ID；不因sourceHead相同跳配置。static cache包括受信context；配置变化未知停止。 |

私有策略初始选定字段：version/installation identity及server现有cookieOrigin、trustedOrigins、authEpoch；不引新secret。publicOrigin必须已规范化，trustedOrigins有界唯一排序用于digest，server仍再次做自己的严格配置/CSRF/epoch验证。具体序列化字段与错误code随实现固定，不能在请求中临时扩大信任。

兼容配置是新增显式v2证据，不修改原v1报告或假造context。导入仍允许有界验证旧报告便于回溯；新configured发布必须v2及全四check一致。策略摘要不含owner/runner/provider token。旧状态读与新configured开通严格区分；若旧指针尚无新context报告，prepare拒绝，不能先停服务再发现缺件。

已有量级仅来自SVC06封存证据：旧30资产4,538,660B，3manifest4,906B，当前三报告15文件5,362B；历史报告全库存UNKNOWN。第四实际App未提供；新count4不是实际发布通过。192MiB和32reports原已有，不提高这两项。完整来源在backend-release/docs/evidence/svc06/update-4fe-candidate/retained-size-evidence.json（fixed1e7c）。

直接验证：缺失defaultoff、合法设置实际env、错误owner/mode/link/文件变更在stop前拒绝；root env无法注入；normalized context等价与不同origin/digest/check拒绝；旧v1legacy成功/configured失败；原3可读、第四成功且旧namespace原字节、第五/byte/report拒绝且指针不变；旧count3宿主拒读4项反例。只跑本模块和必要直接消费者，不重跑已绿artifact或provider。真实Web/后台组合、用户tab、默认生产部署和个人切换均不在局部证明内。
