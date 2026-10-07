# S01P07 原4capacity：4/4，结果待独审

执行 `S01P07-CAPACITY-20261007-R1`，HEAD `59d7ab4e7d14b9b5979221c249c0a68ba3836695`；source/准备仍68815/1de742。4selected/4pass/20未选，13task、120HTTP；旧85非PG与8组中心PG是各自历史证据，本轮不合算成新通过数。

四case分别验证capacity1/4、session互斥、draining/uncertain占槽与保守restart，原断言保持。4串行专库均CREATE ACK/OID/marker确认，app/pool/admin关闭、0连接后普通DROP/absence；PID/PGID31444 exit0/group absent/双EOF/signals[]。wrapper及4个fixture根精确lstat ENOENT，无本轮保留。固定main15847数据库加载标记精确，仍不是全部最新main集成验收。

wrapper UTC03:43:23.897813–03:43:30.717Z/6.819068s；外部time real6.93s、工具exit0于03:43:31Z读回。外壳两个UTC标记误用不存在的/usr/bin/date，原错误保留，shell精确start/end UNKNOWN；fresh preflight至工具完成的扩大观察包络向上取整21s，不冒实际shell耗时。均分列于outer记录，不为marker再跑。

child捕获8606B；27份raw/outer 28919B（含记录与副本）；TMP sampled peak3108939B，不是全时硬峰值/PGWAL增长。fresh组合floor1226964992B在spawn前实采25922850816B，包含已声明两个local全部预算。0provider/install，旧unknown根无访问，R2或本次通过不解释R1。

重窗口已即时归还；仅封存和结果独审，NOT_INTEGRATED。原始字节与哈希见pg-capacity-result-manifest.json，准备manifest/raw全部不改。
