# SVC09 Interface

固定base5b0bef86；17个产品literal和own plan/evidence由claim1a2b634b v4唯一持有。复用既有preview锁、environment白名单、Web artifact校验/发布CAS，不修改后端auth规则、用户任务、SDK或调度器。

| Module | 输入/输出与所有权 | 错误、生命周期与依赖 |
| --- | --- | --- |
| browser-session-configuration | 精确安装目录的可选私有策略文件；返回规范化server选项、非秘密context与文件身份/hash | 缺失默认off；regular/nofollow/self/0600/nlink1/有界字节/安装身份；invalid与采样不明拒绝。prepare/load在任何drain/stop前读并固定；runService再核同identity/hash，读取变化不接受。 |
| environment / preview | 仅受信loader提供center browserSession；wrapper携带已验证的非秘密固定身份，child重新读取核对 | 继承FLOW_BROWSER_SESSION_JSON和任何策略注入值被丢弃；runner/provider环境原语义保持。无新token/config复制、无产品外env绕过。现锁正常finally释放，unknown不声称锁永久留存。 |
| web-retention-policy | 一个不可由请求提高的固定表：4 artifact、192MiB声明资产、32 committed reports；现单体/文件边界保持 | read/plan/load/import统一使用，不散布魔数；原3项全保留，第5/count/bytes/report不足拒绝，不TTL/pagehide回收。 |
| web-release / static-web | 新versioned report携带normalized publicOrigin +非secret browser policy digest；四check原件同context；实际受信expectedContext贯穿verify/find/plan/load | 旧format1只在legacy未配置路径可读，绝不当新configured兼容证明。语义同一context方可复用旧报告ID；不因sourceHead相同跳配置。static cache包括受信context；配置变化未知停止。 |

私有策略初始选定字段：version/installation identity及server现有cookieOrigin、trustedOrigins、authEpoch；不引新secret。publicOrigin必须已规范化，trustedOrigins有界唯一排序用于digest，server仍再次做自己的严格配置/CSRF/epoch验证。具体序列化字段与错误code随实现固定，不能在请求中临时扩大信任。

兼容配置是新增显式v2证据，不修改原v1报告或假造context。导入仍允许有界验证旧报告便于回溯；新configured发布必须v2及全四check一致。策略摘要不含owner/runner/provider token。旧状态读与新configured开通严格区分；若任一保留artifact缺受信新tuple报告，prepare拒绝，不能先停服务再发现缺件。

已有量级仅来自SVC06封存证据：旧30资产4,538,660B，3manifest4,906B，当前三报告15文件5,362B；历史报告全库存UNKNOWN。第四实际App未提供；新count4不是实际发布通过。192MiB和32reports原已有，不提高这两项。完整来源在backend-release/docs/evidence/svc06/update-4fe-candidate/retained-size-evidence.json（fixed1e7c）。

直接验证：缺失defaultoff、合法设置实际env、错误owner/mode/link/文件变更在stop前拒绝；root env无法注入；normalized context等价与不同origin/digest/check拒绝；旧v1legacy成功/configured失败；原3可读、第四成功且旧namespace原字节、第五/byte/report拒绝且指针不变；旧count3宿主拒读4项反例。只跑本模块和必要直接消费者，不重跑已绿artifact或provider。真实Web/后台组合、用户tab、默认生产部署和个人切换均不在局部证明内。

## 历史发布指针与当前运行证明

pointer只决定current/retained集合及CAS版本；其中backendHead/compatibilityIds记录发布时证明，旧字节不自动重写。configured prepare/host显式提供实际backendHead与规范context，load为全体retained查找并核同一运行tuple的v2报告，返回verifiedTuple（含本次IDs），静态snapshot固定这个tuple。无context沿legacy旧pointer证明；缺任一新报告或wrongtuple停在stop前。publish/rollback继续显式CAS并保存新证明，不自动改历史。

启动三roles时父host从selected backend/current固定目标取head；Web-only从已owned state.source.head取head，绝不使用独立Webhost artifact.sourceHead。白名单owned wrapper传非秘密head与策略pin；runService通过原nonce/PID验证后重核pin，受信serviceEnvironment才生成center设置与Web运行tuple。静态identity返回已验证的非秘密tuple；configured ready不得仅凭旧artifact identity误认为已启用新配置。此实验/单元入口不代表旧宿主实际已升级。

## 开启前宿主能力与真实准备入口

web-artifact prepare已纳入同一count策略，包括私有committed store的复用与新slot；实际Vite build仍默认原入口/预算，新增受信constructor build port仅直接消费者小文件验证，不从CLI请求接收回调。

已存在独立Webhost选择时，backend refresh不会自动更新它。configured prepare、启动和replace在stop前验证最终所选Webhost的完整10工具闭包逐字等当前受审operator闭包，不以文件名/版本字符串/自报能力证明支持。新count4准备/发布同样先检查该宿主；最小实际顺序为policy缺失legacy时先受控替换到新host（保原3/pointer/后台），再新backend+已验证policy/context。当前只实现/局部证明，不执行该顺序。旧c7b不被静默当新策略宿主。


## 维护入口的实际选中身份

bootstrap在任何maintenance迁移/drain之前将选定backend descriptor穿透prepare；Web选择仍遵守pendingWebHost/webHost优先级，不把新backend当独立Webhost已更新。configured legacy无backend descriptor时同样前置资格与全部tuple，CLI传入的空target规范为未指定后读取固定repository head。refresh和start沿同descriptor再次检查，再进入原stop顺序，不复制维护FSM。

CLI原maintenanceRuntime解析后、spawn之前调用同一工具资格Module：configured策略或已保留第四项时，选中的维护runtime必须与当前受审operator完整11工具（Web10+maintenance-host）逐字同。旧backend artifact不能借自己的旧maintenance-host绕新drain门；缺policy/原三项legacy继续原选择。此处是可信host固定源码资格，不是服务器自报cap，也不是文件名存在即可支持。

部署顺序仍须后继固定实际产物和兼容报告：先legacy模式安装/采用新宿主保原三项，再受审backend+私有策略+全部v2 tuple，最后独立第四CAS。旧artifact不重写；有不匹配便拒绝，不先停服务赌readiness。whole-module VM用例仅在链接时提供内存PG/process ports，执行原完整模块源码，证明顺序/参数及no-spawn；不声称真实PG锁/迁移/宿主安装已运行。
