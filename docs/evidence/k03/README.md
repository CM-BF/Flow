# K03：节点固定知识输入与过期保护

固定实现 `21d2e05eb571e44883589eb38bff6b5a4b2eaeb7`。branch起点为已审K02领域a6c9b09，按Lead授权完整无冲突合入115b0db、随后acfd409；对当前共享基线acfd的K03差异是审查对象。20个源码/测试/harness、14个只读输入与148个原始证据的完整SHA/命令/UTC/exit见[manifest](manifest.json)。0模型、0云。

owner可以在节点输入中选择至多4个精确引用，单个4KiB/合计8KiB。define同事务存不可变context；execution与恢复只编译已冻结字节。上下文摘要覆盖有序引用/原文，执行摘要另覆盖publicPrompt/templateVersion/最终中心prompt，不声称是adapter追加material路径后的完整SDK输入。完整执行prompt受16000 UTF16与49152 UTF8上限，失败整单回滚。public task保留原业务prompt；实际授权claim仅替换私有assignment.task.prompt副本，不扩ClaimedTask字段。

来源版本变化使该节点过期，即使内容digest相同；主动选旧引用也不会自动换成当前版本。已有accepted binding与历史正文保留，current沿真实dependsOn递归，独立节点不受影响。新execute/accept被阻止，已运行输入不换字节、不自动重跑。runner不得增删换序owner引用或执行知识节点；这些门禁在新command callback内，不破坏已受理ACK重放。C02两种显式恢复只建立新private input，保留contextDigest并重算execution digest，不新建goal_execution、不恢复deliveryCurrent、不自动native resume。

| 检查 | 实际选择 / 通过 | 证据 |
| --- | --- | --- |
| 新领域与真实claim组合 | 20 / 20 | combined-final-matrix.log/result，5文件，22.20s |
| 原目标消费者 | 9 / 9 | goals-consumer.log、对应consumer/result与executed-source |
| 原授权消费者 | 9 / 9 | authorization-consumer.log及安全副本 |
| 原C02重试消费者 | 3 / 3，另9未选 | recovery-consumer.log及安全副本 |
| 原K02 claim消费者 | 3 / 3，另20未选 | context-consumer.log及安全副本 |
| TypeScript | noEmit exit0 | combined-final-typecheck-result.json；空stdout不单独当证据 |

合计44个不同用例。最终20包含精确CRLF/Unicode、8KiB控制字符的实际JSON预算、旧版本、相同digest升级、metadata一次head查询/无引用零新查询、插入失败全回滚、双context DB拒绝、声明缺失/FK与腐坏failclosed、真实claim失败回滚attempt/owner、原runtime+fixture adapter读取完整私有prompt、跨project/重复/坏UTF8边界/坏digest、权限与重放、两恢复策略/丢弃ACK后重启/预算rollback。fixture产物可合法回显材料，因此公开泄漏断言针对执行前投影或原task.prompt，不能要求合法artifact永不包含知识。

旧消费者只改资源/迁移header和相对import。每个安全副本保存原源码SHA、原/生成body SHA相等、实际执行源码、独立命令/起止/exit；临时generated测试已删除。goals/authorization/recovery跑于115b组合，K03产品源与最终target一致；acfd新增CHAT05真实影响由最终20和K02 claim3覆盖，没有无依据重跑旧21。所有实际fixture调用真实createServer鉴权，021由夹具在listen前显式migrate/register；这不是生产自动挂载证据。

最终20使用10个独立临时库，各file资源名独立；旧consumer4个独立库也正常关闭/DROP且remaining=[]。没有触旧flow_o01/flow_c02或别人的服务。较早domain-matrix行为/恢复a/b清理JSON同名，覆盖了两条先前观察；保留原run与resource-audit（后读remaining=[]），不倒填丢失单库事实。后续file前缀修复已在最终run验证。check.mjs同步wx占用新log再spawn，result也wx，拒绝重用label覆盖证据。

失败保留：normalize红为未归一；persistence首次是夹具遗漏expectedVersion（不能算功能红），修正后的404才证明未冻结；seam首次把TaskSummary误作有prompt以及相同noEmit错误已修测试；execution红是没有绑定private input；behavior首轮用了错误verification字段，改用原verifyText且加强独立B来源后绿；version-range红为PGint越界500，窄修后400；实际claim红返回原业务prompt，最小接缝后绿。所有旧raw原样保存，不以最终通过覆盖历史失败。

限制与后继：Mika独立review尚待，GO接收与生产021自动mount/client/CLI/main尚待。O03/O06旧阶段migration fixture仍由F01处理：旧schema阶段直接调用最新claim会缺018/017/021，这里不删断言、不补伪表、不吞缺表，未运行/未计入44。新无知识state/define实证不查询新context表；生产必须先迁移021再开放claim/recovery。无A2A配送、hybrid/vector或新knowledge grant。耗时只是功能检查执行记录，不是SLO/容量证明。
