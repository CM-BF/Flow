# Recovery created-turn — 344f parent fix retry preparation

PREPARED_NOT_RUN。HEAD `7c7ee77d42e9af484237d62d30f9bfda4e613d73` / source `344f12cc9407a1cce8d17e2d9371cf8d0fb9a4b5`；19源码固定，18其他源与整个worker后缀同67f8，现有cookieRead+createdTurnAckLoss业务断言完全不变。Parent344f仅正常timer退休与exact失败计费接缝，root6f452限定源/32项/noEmit独审已接受。不是PG/Chrome通过。

唯一选择`created-turn-ack-loss`，同原两组。上次run`recturn-20261007-070121-4aa406`仍overallFAIL，worker2/2不冒casePASS；保全部111原raw/376527B、originalbudget.complete=false，以及独审已接受的DB/fixture/ownedgroups/EOF/scratch/adminenv清理。Gate必须显式携带manifest内reconciledFailures（budgetSHA b47589…/rootreportSHA513034…），只作原失败11109ms计费，未知incomplete仍failclosed。旧gate/env绝不复用。

新150s段spent47205/rem102795；本次single最多60000=45000work+15000cleanup，ceilmax outer/late/parent。旧90k64134.08675封闭；parent历史原budget求和与新segment保守账是分列来源，不能拿早raw回增额度。原full7/choice/firstcreate通过均不重跑；Queue尚未跑。

实际输入9public/11packages/11runtime/Node24/installedChrome.99和4public补充仅文件读/hash核同，无import/安装/资源采样。当前own证据逻辑2810787B，为静态记录非实际磁盘峰值。清理/权限/原sameRequest body-loss/0autoPOST/nextdraft/taskturn身份不改。0provider/个人service。

复用manifest原Node--env-file--importtsx single-fileparent与原outerstdout/stderr/actualexit/双EOF捕获，不造wrapper。实际launch仍需manager fresh exact6ffv4原21/source/HEAD/依赖/合计资源及真实PG+HTTP+Chrome交接，未消费唯一gate+新受控adminenv。当前无gate/adminenv，无PG预约，也未运行。未来admin仅传路径，不读取/打印值，由manager exactidentity删除。
