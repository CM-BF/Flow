# X01 阶段 A 薄监督调用方（源码准备，NOT_OPEN）

此页接续冻结的d12准备包；纠正其“没有通用supervisor”的历史结论：已有OPS14公共 `supervise(Launch, Policy) -> Report` 可复用。固定实现来自main `8dcd3c9d6918268e0c406a970d82972abd246b06`，外部路径 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py`，12543 B / SHA256 `725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d`。只读取/导入该模块，不复制监督循环、selector或kill逻辑，不迁移旧SVC/REQ入口。原ade4产品/034/host、d12输入/依赖请求及其已绑定配置全部不变。

新支持源码是 `enable-binding-check-once.py` 与 `enable-binding-launch.py`。前者只组合OPS14，后者在同一PID/PGID中先以wx0600/O_NOFOLLOW记录label、nonce、PID、PGID、UTC与固定argv，fsync文件和同identity父目录后才exec固定Node；任一步失败zero exec。Python不生成compile cache。同步policy/其他产品Module不导入此验证代码。

先核固定输入、7个精确链接/包元数据/工具realpath/hash、fresh余量至少1,107,296,256 B及独立run目录不存在，再排他预约。OPS14以NEW_CHILD_SESSION+MERGED监督一条只读Git status预检（1s work/4KiB）及原strict→Vitest两个命令（8s/14s work）。Git禁可选index写、无网络，完整检查tracked及untracked；只允许该次先行排他创建的两个精确文件reservation.json/admission.json，不能排除整个目录或忽略其他untracked。运行命令不会读取任意@flow主树别名。两个check child的checkpoint均在其监督期限内持久化；无on_spawn callback阻塞监督。实际计划另含11个真实tar子进程，与业务17case分开计数。

准入Interface为：固定Python解释器执行`enable-binding-check-once.py --mika-approved-once <reviewed HEAD> <absolute admission JSON> <SHA256>`。单独Mika准入步骤先fresh读取真实ledger，生成≤8KiB的JSON：`kind=X01_LOCAL_CHECK_OPEN,state=OPEN,lead=mika,reviewedHead,windowId(32小写hex),ledgerObservedAt,claim`。claim的claimId/version/lead/worker/role/taskId/state/branch/worktree/scope须与已绑定v8原子receipt完全相同（17个scope顺序也相同）；JSON字节hash由准入回执传入。caller验证时间不在未来且≤60秒，并在预约前及每个check前复核有效期，原JSON逐字存入本次admission.json。它是同机协作准入证据，不声称签名授权或持续租约；不以flag单独证明claim已核，不从caller连接PG/复制协调CLI。批准源码不生成OPEN回执。

总origin在调用方第一项time import后、其余imports前，30s覆盖内部预检/check/收尾并在各阶段夹紧work留3s；各监督调用TERM .25s/KILL .75s。Python解释器启动以及最后CLI退出必须由外部工具wall/UTC补证。**OPS14不监督调用方返回后的读盘/fsync/rmtree**：这些步骤有前后时钟检查和实际elapsed，不宣称OS I/O硬截止或最后报告持久化也被模块保证。实际完整窗口是否≤30s须工具退出证据共同判定，超限不抹失败、不重试。

原stream总448KiB，tail64KiB，全部新raw512KiB（含reservation/checkpoint/fixture/receipt/CLI）；CLI预扣8KiB，非零业务exit与raw是否完整独立。任何group/EOF/capture/persistence未知跨阶段粘住，不启动后续命令，不把后来的absent覆盖早先unknown；截断记录observed但未保留字节，完整总量不可证明时明确unknown。原输出全部保留，不覆盖d12或其他窗口。

新`flow-x01-local-*`根创建后立即登记原路径，再记录dev/ino；TMPDIR/TMP/TEMP与Vite cache指其有限子目录，子进程环境省略HOME且不创建替代home。只在全部监督范围/EOF确定及同root identity、有界不follow的4096项/32MiB样本成立时收尾；样本只是observed，不声称覆盖采样间峰值。特殊节点、identity或资源停止未知KEEP。fixture须17/17、精确两测试路径、11tar close0/11own root在该TMP namespace已absent；空选择/跳过/未确认清理不算通过。root/receipt最终保存失败会用有限CLI保留已知身份，不能称成功。

目前仅写/只读源码与文件绑定，**0 import、0 syntax/type/test、0链接/安装、0PG/Chrome/provider**。d12依赖设计已独审（2026-10-06 23:45:58 UTC）：50TS/225154 B、154静态边、7链接/752 B target文本全部核符；这不批准本支持源码，也不开放执行。下一步为固定support manifest与独立只读review；正式运行还需要sole依赖供给、fresh资源和Mika单次OPEN。
