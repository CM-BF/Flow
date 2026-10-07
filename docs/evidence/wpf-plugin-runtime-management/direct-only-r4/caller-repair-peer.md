# Plugin direct-only caller 最小修正方案

固定 metadata `4219f9f44ad5e6c5dcfa74b230511e7417155d6d` / 产品source `6544b66b9b711ba861c67547417c3eb5c5bca074`。仅10个输入（pins.json），不复制51raw、不改项目、不运行或采样资源。原root报告SHA `9a48b14fb8c7d990486ae5f37c08f221393501bc98850acb5f4d314399ebf6ce`已接受strict，direct仅15PASS JSON，原phase/parent FAILED必须保持。

**结论：只修现有direct-only run.py的启动预算与finally分支即可；已有两份同类方法可引用，无需新supervisor或重跑strict。** 下述line为fixed4219的 `docs/evidence/wpf-plugin-runtime-management/local-phase/attempt-3/run.py`。

## 1. 启动前拒绝不可用额度

L33–34算 `raw_cap = rawCap - sizes(BASE)[0] - 131072`，L64不检查正数就Popen；L46把负额度clamp0，第一93B全部丢弃后L47抛rawcap。

由原51raw index中六个必需prepared文件(run8821/binding4104/live1345/expected1225/sandbox175/config1149)即16819B，binding.rawCap146404，保守上界已是 **146404−16819−131072=−1487B**；这不是对历史启动瞬间重新采样，只是已足以拒绝的静态下界证明。

最小改法：在SCRATCH.mkdir/Popen前，先记录唯一preparedBytes、已封存旧attempt留存及terminal/结构化JSON/外层捕获预留；计算effectiveOutputBytes必须>0，否则输出限量NOT_RUN失败收据且不spawn。已审Recovery50 `run.py:213–216`（SHA6141801352f7274abb3b01fa6081aed2d86c7d8e416fa802a3fdd863460862e7）正是这项前置，不需复制其整套gate。旧phase30082/30000已经关闭，不能把压缩packet或JSON PASS当剩余runtime信用。新额度由原owner新有限段给定，本报告不授予。

## 2. Prepared / raw / terminal 的同一口径

用现有sizes的小增量明确互斥分类：prepared固定文件、live scratch、retained原始输出/报告。每个实际路径在一次遍历中只计入所属类别；不要用两次移动树总量相减，也不要将同一prepared字节既扣effective allowance又在使用量上重复相加。外部pinSet/旧raw只引用hash，旧留存计在总阶段账一次，不复制回来。

为direct JSON明确结构化上限（现L75为262144）并预留其归档副本/终态，而非把全部可用余量先给stdout。保持保守上限，不因本次实际JSON4883B就无证缩小未来最坏值。SCRATCH里原JSON与归档副本并存时确有两份物理文件，分别计scratch和retained；删除只在owned absence确认后。执行中采样，reap后/删除前终态采样，再写result/budget/terminal及外层stdout后核真实retained和耗时；预留不足失败，不循环重写大报告挤空间。原rawCap146404不能支持现有预留，不能绕过拒绝强跑。

## 3. 清理异常不阻断收集真实结果

L82–105是一个大try。`alive()`/`stop()`（L20–27）仅捕获ESRCH，EPERM会跳过L88–104的wait、drain和身份记录；实际result.cleanup={}、exit缺失、两EOFfalse符合此路径，但原证据不能确定EPERM具体发生在probe还是signal。L93 cleanup的drain还会再次因drop抛出，继续遮蔽后续清理。

复用已验证ACCESS caller SHA09ac049a54b315d9cca9c10f78ce5209a198da5f644e2174b1d4ef95a42ceb5f：`signal_owned:34–37`将异常单独记录；`finally:54–78`在失败后仍有界drain/wait并独立观察ownedgroup；只ESRCH当absent，unknown/live保scratch（83–86）。其root审SHA7e8816588031ab9f2ba726c71d63f948402473a88830ad211dd91d4d080ed1ba有原两项合成实际EOF/权限检查，不是本plugin已通过。

本caller最小分拆为独立的signal尝试、wait/双流drain、PID/PGID终态、post-reap计量、可安全删除/报告五步，各自捕获错误仍做下一步，全部受同一绝对cleanup deadline。drop仅限量保存并持续读/统计丢弃，工作阶段要求FAIL；cleanup drain不能因同一个rawcap再次提前退出。信号handler只记录停止事实，正常finally执行清理，不在handler抛EPERM。权限/IO错误永久留FAIL，不借后续进程消失抹掉；组unknown不删scratch、不广杀或扩大sandbox权限。

保留原最终标准：唯一direct/exact15名称全部passed、0skip/fail、child真实exit0、parent/outerexit0、双EOF/drop0、ownedgroup与scratch确认、时间/配额/停止事实均合格，才能收run PASS。回收JSON/晚到补充cleanup不能补造旧childexit。原strict已过，不重跑。

## 给原owner的最小验证建议（本报告未执行）

在原有限local段直接取修后真实函数，用三个有界受控场景：非正/不足预留在Popen前拒绝；正额度的prepared/raw/terminal边界与末尾一字节超限；权限错误+输出尾巴仍收childexit/双EOF/owned状态且整体FAIL。复用已审方法，不另造镜像实现/通用框架。W01原7scope仍唯一写权；本报告只TMP设计，不是实现、重跑许可或cleanup已发生的新观察。
