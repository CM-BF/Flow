# 同一已确认目标的未消费两步执行：新阶段候选

记录：2026-10-08T02:58:43.768Z。本候选 **NOT_RUN / 阶段准入 NOT_GRANTED**；既有 GO 对最多两次 children 的总体额度仍未消费，不请求新增第三次额度。实际 SDK 累计4；本片新增0。旧短窗口 NOT_RUN、confirmation/pause 已过期的事实不变。

实现 `8b31a1fedb0b7d8400c0ee0c997761710bc935a0`（生产变化固定214a9bf；后续仅新增实际文件消费者），sourceDigest `d6eb39e51601d66b21919346b302a7035bdeb4ed95470398389ea183d41be30e`，env `fc5eb96c84081b60cc65a5bf912bd26f3e8820ca5bf3fcf5e8105001aa439bd8`。以 [source-delta](source-delta.json) 对原5cf8/2d0完整逆算，329来源/39依赖，沿原 Node24、SDK0.3.290/native2.1.290；不换base、依赖或模型。结果见 [validation](validation.json)。当前原claim55c4e833 v1 exact3，独立审查待最终绑定。

复用原 run `native-children-continuation-20261008-once`、原 goal `7d22a98e-3337-4d6b-bd39-1f5403f739c2`、proposal `9a3d0320-efd7-4d65-828c-adb42d6dd5c2` / `fe9b12ce0ef7746c399047633639c7c27ad5fe9f21b82cef60b4a4c4de1e3f7b`、两份当前输入与两不可变 profile。原确认摘要38e391109723f0f8cd3bff6e584889ee1f0d8cf7d8ca512962d31f9465235f54和旧progression9a39e855-637c-4067-846f-49d6d49da006保留。

## 三个独立期限

1. **总体额度**：沿GO已授权但未消费的两次顺序Sonnet5-5；每次≤3turn、SDK估价USD0.10、query≤60s，合计SDK估价≤USD0.20、累计调用≤6。SDK估价不冒账户账单硬上限/免费保证；费用未知仍UNKNOWN。0重新planner、0新功能/账号/fallback/retry。
2. **新阶段准入**：所有固定输入、资源候选和operator READY 后才签发实际 `approvedAt=T` 与绝对UTC `expiresAt=T+5min`；D01 latestStart可以更早，取更早者。准备等待不启动该时钟。此处T未签，不预填grant；一旦签发不自动滚动延期或换run。原02:36:47截止的旧确认和已消费窗口永久不改。
3. **中心授权及实际执行**：新公开 create 的 `authorizationExpiresAt=T+30min` 是与准入截止分开的绝对UTC，不继承旧expiry；代码要求至少准入截止+17min30s且≤24h，并在成功关闭生成pause前再核覆盖15min pause+children完整150s。三个实际stage各仍120s工作+30s收尾/150s，不从30min扩运行预算。后续新pause仍固定实际关闭后15min，到期拒绝/保留；实际children开始前授权与v3permit均须覆盖完整150s。不能仅延长permit绕开旧中心授权。

## 原入口与顺序

所有阶段仍使用同一固定 `node --import tsx experiments/continuous-goal-acceptance/operator.mjs` 和原监督/计量器；工作目录为本canonical WT，显式 `FLOW_O16_PG_WINDOW=approved-one-shot` 只在各D01独立准入成立后设置。下面参数中的绝对材料路径在各阶段真实许可后固定，当前不创建实际grant/permit/reservation。

| Stage | 唯一参数与允许动作 | 通过与停止条件 |
| --- | --- | --- |
| reauthorize（0query） | `--reauthorize native-children-continuation-20261008-once <absolute-new-stage-grant.json>`。同一原pause消费门+旧确认摘要全局wx；验证原件/source后原center scan=false。公共读取过期旧授权/0admission/current revision/proposal/input/profile与无execution；持久revoke意图→一次ACK→持久create意图→一次ACK/GET。新授权仅expiresAt/reason有意变化，原两节点/profile/依赖不变。 | 原marker/目录/0连接/全输入成立；public revoke/create仍各自实际锁/CAS。GET不冒跨命令原子锁；现场变化由公开事务拒绝。未知/写中断/超时不重发、不回滚、不换run。新receipt同时保旧confirmationBinding和新executionAuthorizationBinding，0admission、完整关闭和新pause是后继前提。 |
| continued-children | `--continued-children native-children-continuation-20261008-once <absolute-v3-permit.json>`。在真实新ACK及完整RETURN之后、下一D01窗口READY时绑定原确认+新progression/authDigest/source/env和仍未消费两slot。 | 首端核新pause/source/材料；真实assignment还核task/attempt/runner/current profile及新progression。原单扫描器顺序分派，最多两次SDK。任何失败/unknown停，不请求第三次、重规划或修复性query。完成两artifact后另一个15min pause。 |
| continued-decide（0query） | `--continued-decide native-children-continuation-20261008-once <absolute-independent-decision.json>`。独立角色对实际两artifact exact bindings给accept/reject与理由，下一D01窗口内执行原公开接受CAS。 | 固定纸鸢0.1/草稿预览/内部测试四事实，≤120汉字且无编造功能/日期/链接，先起草再事实核对/修订。机械验证不替代独立语义判断；reject仅原实验理由记录，不伪称产品有独立reject命令。无正式发布。 |

## 来源与资源保持

原真实 renew [result-manifest](../native-children-continuation-20261008-once/renew-result-manifest.json) 与 [children-not-run](../native-children-continuation-20261008-once/children-not-run.json)作为不可变来源，限定renew独审main d25dda8f1；本阶段不重复确认。原原件五文件与原private journey.json不覆写；`execution-origin.json`只索引原路径/摘要。新工作文件为原renew-private中的journey-execution.json，公开执行文件为execution-resources.json/execution-pause.json及阶段专用报告。旧run、旧DB、原两个private全部KEEP，finish也没有DROP/删旧目录权；不创建第三private。

最前按readProgressionRenewal真实读取集合核对：原pause、confirmation、resources、journey、只读material及原目录身份；不设虚构总读取次数。所有源码/依赖完整identity逆算与一次门未消费、旧worker记录已停/无未知、marked DB属主/无目标连接，新阶段没有旧UNKNOWN身份借用。公有数据fresh检查由实际center读取，不用已保存admissions0冒当前事实。未知在门消费后也不自动重试。

容量沿现已授权原两目录/DB，不重置：原renew-private运行材料总8MiB；同一run的operator/证据跨stage累计2MiB，旧记录已占用从可用余量扣除。原planner-private是已封存只读来源；共享正常HOME/Keychain初始化与必要refresh仍原同账户授权，不能称受私有8MiB保证。额外本地检查cache1,501,866B封存KEEP是存量，不当未来增长。DB/WAL的既有未来保留由D01完整账本合并一次；不声明128MiB是DB硬cap或pool.end是远端同步零。

候选保守13连接（center8+boss3+admin1稳定12，加1关闭中预检连接余量），fresh可用≥29含16安全余量；预检pool关闭后才开始。intrinsic live1GiB/start1GiB+128MiB保持，实际以新D01完整floor、剩余private/run字节、owner/claim/目录identity同call核对。每stage真实START/terminal/进程+连接完整RETURN分开上报，健康/封存保留不作已删除。新阶段实现和12不同直接消费者已完成；实际PG/授权替换/children/独立接受均未运行，当前0child/0pending。
