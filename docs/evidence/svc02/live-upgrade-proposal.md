# 现态只读升级提案

事实快照：[2026-10-06 05:28:35Z](live-readonly-facts.json)。唯一private installation原记录source75a33、三自有wrapper仍running；61227/61228不变。全DB无task/未完attempt，唯一注册runner为该受管Claude runner，其他nonrevoked runner0。016未安装；没有迁移/POST/stop/provider query。配置仅在内存核验，输出身份布尔和既知PID，不输出credential/hash原值或数据库URL。

这是单时点事实，不是锁或部署授权。sourceAtStart是启动器当时保存值，不是全部加载模块的重新证明；Vite可能随工作树文件变化，不能以该值宣称当前Web bundle也是75a33。其他注册runner为0不能证明无同凭据重复部署。没有idle presence协议，无法从null heartbeat断言执行端离线。

待Lead完成已审固定main的016/module挂载及thin client接线后，窗口提案：

1. Root明确受控窗口；部署owner确认本库仅这一受管runner部署，并在窗口内不新增runner/部署或提交新任务。再次只读核所有runner未完成attempt/身份/源码clean。
2. 通过已审host bootstrap启用兼容guard与drain，核持久回执。失败只保留未确认；不因为先前0就直接stop。
3. 等当前受管任务完成，uncertain仍阻止；重新核没有其他runner工作/部署。若出现或未知，保留关闭并升级协调，本片不提供全中心多runner drain。
4. 以明确40位已审main运行refresh；原DB/credentials/native目录/端口/tab保留，HTTP不能解除maintenance，整个本机过程由operation.lock持有。PG锁不跨启动，中心启动可独立执行迁移。
5. 新进程/center就绪、source固定且仍maintenance后，保存事实交Root；不自动resume queued。只有明确恢复接收后才执行resume，它可能使已有合法任务调用模型。

失败/回退语义：只对已核自有PID发送TERM，有界失败unknown；不SIGKILL、不撤销外部副作用、不自动回滚源码/删除DB/开启队列。bootstrap成功后即使旧75a33仍运行也受DB guard限制。部分新启动失败可能只留部分进程记录；缺失身份仍unknown，须人工核对，不能为了重试补造PID记录或抢operation.lock。维护记录未知/遗失同样拒绝自动接管。若需回退源码，先确认仍有可用的已审maintenance入口和显式恢复方案；不要删016或手改flag绕过审计。

只读风险检查：现态满足“无其他注册runner/未完attempt”的可观察前提，但没有全局部署存在证明；受控窗口的单runner约束必须持续成立。与root已批准范围一致，此次不扩产品为多runner协调器、不新增工具、不重跑测试。
