# 当前精确未决 intent 的最小处置提案（历史初稿，未执行）

本提案只处理13:22:52实际只读观察的单一80B admission。R4已经bootstrap/draining，原迁入、Web-host、三报告、策略和bootstrap都禁止重放。无新模型query，不把退役当缺失claim ACK或成功任务。

## 已绑定事实

- 安装727db807-5997-45cf-ace2-b5d1fd06f1eb；runner d22f4df2-8242-49f4-a1b4-77f8f08611ef；中心61227/Web61228。
- 同maintenance operation e6550b3c-1f67-4c2c-869d-e84d5e838113，draining/v19/active0/uncertain0；两次原公开status一致，不是新的hold批准。
- 唯一namespace 89e1cca3c7a4a0e0709f41235d7dad16fca80aa01a1fbe9822e85ab8fb4762f1。journal dev16777234/ino123285855/uid501/nlink1/0600；80B/SHA cad3b336e5c36bf584eadc516625cb0c24be6ff1bda71680975ed896f6b23c31。inFlight UUID仅摘要 d52b4dadbb2811c4f5a75105294d75d3cafa56f8fac0210bba57883feebd07ae，原值只留个人文件。
- version1三键、assignments=[]。旧runner实际af51，state.backendArtifact仍null；root工具7524中固定6c闭包，目标产物7d1/6c，Web-host已7d1。R4facts-before是最后完整保留基线；诊断不是新的全历史采样。

## 复用与不能直接复用的边界

引用原已审 intent-retirement/{retire,host-fence,hold-stop,operator}.mjs、其独审和实际结果；本目录readonly-static-inputs.json只列必要小源hash，不复制完整closure。原retireIntent的exact read、同目录备份/intent/stage/二次confirm/rename/dirsync/audit、withPreviewLock与runner行锁、stopOwnedProcess身份语义可以保留。

旧operator许可kind/expiry是旧单次；旧hold-stop/host-fence还硬检查root Git==af51与旧snapshot，现root7524不能直接调用。旧core assertConfirmation另要求pendingTasks=0、pendingQueue=0，而本次保护基线有一个queued任务；不准取消它、伪填计数0或在port偷换含义。因此当前旧入口静态不可直接执行，不能只换request就宣称适配完成。

需要的新明确裁决是：在全库未完attempt0/uncertain0、完整历史/outbox/final/unknown全核、runner确停且同op持久hold的前提下，是否允许保留原queued任务/队列逐值摘要而退役这一精确未决intent。若允许，须在合法exact scope给旧core新增显式、严格版本化的本次确认合同（原默认零pending规则不变）并提供直接反例；或提取其现有单intent提交primitive后由同一受审guard调用，不能复制字节提交协议/伪造原确认。当前无此新语义/写权，尚未实现。

## 新批准后的一次具体顺序候选

1. 新私有exclusive操作身份与固定旧文件hash/identity、原R4op/CAS19、root/runtime来源、全部保留基线。只读fresh匹配；不重基准、不创建新bootstrap。先核全库marker/runner/全部未完与uncertain为0，原5任务与queue摘要不变，完整固定namespace仅原四历史+精确journal，无任何pending/final/outbox/陌生文件；读取只输出hash和计数。
2. 现operation持久holdKey、expectedVersion19、同op，经既有trusted-host维护入口进入maintenance/v20；exclusive intent先落盘。仅原stopOwnedProcess对原nonce/PGID runner执行一次TERM，确认全组stopped，其他role不信号；不能仅凭父PID消失。未知保留并停止。
3. 在原preview锁→同runner DB行锁内再核marker、同op/hold20、唯一安装writer、旧runner整组确停、完整history/pending与queued保护。用新受审确认合同绑定真实计数和baseline，不伪造旧零pending。
4. 复用原退役commit：私有0700目录、0600 original.bin先file+dir fsync；持久审计意图和原/固定新hash；固定candidate只改inFlight为null，assignments仍[]；二次fence/文件identity与hash；同目录atomic rename+dirsync；最后审计。公开证据不含原UUID/正文。备份、意图、audit任一步未知都不重写/rollback，保留stage与原件。
5. 只读核固定80→46B、备份/审计hash、严格idle和全部历史不变后，才考虑同op原artifact refresh→paused保留checkpoint→一次显式resume。不得先调用当前host resume（它只接受ready-paused），不得为恢复可接单重投claim或调用模型。原history比较须明确计入这次真实维护audit及唯一journal差量，不能现阶段声称原checkpoint已覆盖新语义。

## 时间、预算与失败

原drain时标13:19:53.793Z、900秒截止13:34:53.793Z不延长、不重置。旧窗口已经返回；到时不继续原更新动作。若新语义获批但原剩余不足，必须由Lead另明确一次独立恢复窗口与截止（建议全段240秒、原OPS14+2秒reap），不是自动续时；仍同原operation，不重bootstrap。

候选新增私有审计/证据≤1MiB、raw≤256KiB，沿原≥2.5GiB、live1GiB并叠加团队fresh门槛；不扩大产物空间或模型额度。所需PG连接与原public维护相同max2+确认max1，阶段顺序不重叠；实际新holder由Lead安排。任何意外用户工作/身份变化/新unknown停止，不取消、清journal、rebase或自动rollback。

仅发owner-http同op/CAS resume可以解除中心drain，但runtime仍因inFlight不null阻断claim；这不是恢复实际接单的证明，也未被本提案执行。真正恢复必须解决该精确intent语义和重新启动后本地journal状态，0operator query保持。

## 后到条件授权与固定实现

GO已明确允许queued逐值保留；新显式v2合同与实际SQL/同锁证据已实现，旧零pending默认保持。当前可审入口及全部停止/迟到HTTP边界见[唯一Interface](../queued-intent-contract/Interface.md)和[固定manifest](../queued-intent-contract/manifest.json)。root工具上下文更新ae8500dd，旧运行af51和目标7d1/6c不变；新段最多15min且不追溯延长R4。上文未授权/建议240s仅保留初始提案历史，不代表当前审批结论。实际个人续接仍NOT_RUN，需独审与fresh窗口。
