# 实现与定向验证

状态 **IMPLEMENTED / COMBINATION_REVIEW_NOT_STARTED / NOT_OPEN**。Mika于2026-10-06 14:03批准2ac设计；当前源码与证据正在固定。资源14:08暂停后，14:13:40收到实测恢复；14:14:44启动前Data 1,149,132KiB，高于1GiB+32MiB门槛，恢复既有小检查，无安装/PG/大build。

14:14–14:18，Vitest4.0.18/Node24.20：新两文件29通过；直接消费者8通过/60未选；新增收据故障及受影响消费5通过/15未选，其中2为前轮重叠，**40 distinct，非同轮40/40**。0实际诊断目标/监听/编译/SDK/provider；fake command/transport/listener不证明真实时序。各命令/UTC/退出与原stdout/stderr在checks。Node24内建transform原生惰性import实际0factory/0listener；6个JS与1个shell语法检查均exit0；不是启动窗口。

已接线：cause新增固定runtime-metadata-control recipe，局部private disk cap由旧24576独立为65536（profile16762+脚本379+双8192=33525），快照与reserve/add使用同cap，旧默认不变。新control prepared强制0，准备总量在组合只计一次；exact exit7/40B与完整双流/settlement独立判定，不借loader-error谓词。

Node batch新增固定single-canary分支，所有sandbox/182/期望均按stage身份；仅新profile副本上限32768。严格正常完成才资格化182B源码上界；失败不推wire捕获/空队列为0。新有限Reason观察在两槽私有流删除前执行，只返回操作/类别/显式errno/固定role；额外只读descriptor自身close未知会阻清理和计量确认。

新薄组合复用两个资源owner，不管理新child。全局performance起点0：cause仍20s前启动/30s内完成，canary只global<45s且剩余预算充分才进入，global≤60s；外层复用time+UTC结构，自动末次写后门禁，真正shell exit仍需tool完成UTC。计prepared一次、actual observed/captured、实际disk副本、合格182、全部receipts；把控制槽既有支出和outer8KiB预扣传给Node budget以防内部单独超总额，reserve不当实际bytes。收据丢失则targetCalls=null/knownTargetCalls单列，不把未获回执当0目标。

已执行的定向范围：新recipe/Reason两文件、已有compose新增固定profile用例；旧默认cause单目标、Node三槽、旧compose控制/七项直接消费者小选择。追加边界包括双8192磁盘/默认24KiB、精确1+1与失败0第二槽、错误sandbox/close/报告、共享时钟、未知owner、路径链漂移、receipt/CLI上界与有限Reason。所有均fake transport/command/listener和自有临时文件，不是实际Node/Codex时序或权限证明。原生惰性import与shell/JS语法检查原始证据亦已保存。

clean-code安全点：复用既有command/R06/清理，不复制supervisor；固定recipe拒任意路径；错误统一有限状态，不外泄raw；预算值命名区分actual/reserve/source bound；未知资源与已确认失败分开。发现并修正新disk cap快照漏接、单canary index语义、组合丢回执误称0启动、第二槽额外观察descriptor关闭门禁；这些已有对应pure行为验证。新增最终收据故障只对新recipe返回safe结果+resultPersisted=false，保留已知root/artifact身份；旧默认仍throw。组合丢Module回执时retainedRootsComplete=false，空部分数组不表示无残留。方法沿本地find-skills/clean-code sickn33@bdacd76/codebase-design。新源码修改旧helper的当前版本，旧sealed manifest只按历史Git解释，未改旧raw/profile/预加载/peer/生产R06。

14:19 clean-code安全点：source保持固定recipe/单一资源owner，未复制R06/第二supervisor；两个helper只由薄组合分配共同起点和实际预算。private outer stderr精确info/exclude规则已核，未创建任何运行产物。当前旧helper源码变化属于新commit，历史sealed raw/profile/manifest仍冻结在其固定Git，不声称当前helper与旧manifest相等。

14:20预核新增两处需修：第9个合法errno在8明细cap后丢冲突；失败canary的182内部预扣被展示为已资格上界。review-red为3失败/32未选，已按实际保存，当前检查点不可交审批准；下一提交仅修两处并测直接消费。

14:21修复：有限errno集合在明细8项cap前更新（最多1..255），第9项冲突回归通过；失败canary的182现在为null+单列未资格预扣，knownBytes不纳该值。原3red保留e2f40f13，随后Reason全15+组合直接3=18通过/17未选，累计41distinct；原生惰性import及两个变更JS语法再次exit0。0实际目标/监听。
