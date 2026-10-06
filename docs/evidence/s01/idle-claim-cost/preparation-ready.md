# Idle claim 固定准备交审

Source `0de832643a07191f22b7eb10337958fffd47d39e`，固定生产 `8d84d529a0756116bd0fc8bad969d61a6c26248e`。[准备manifest](preparation-manifest.json)绑定[fixed-input](fixed-input.json)，74文件362257B + 输入清单16618B = **378875B**；已逐项核Git source=current/hash，0错误。61项镜像来自Lead专门供给，非owner自行Git物化；其余为9个实验源码/config与4项准备文档/收据。

**全组合 NOT_REVIEWED；fake、类型、语法与实际调用全部 NOT_RUN；actual NOT_OPEN。** Early731 observer/budget于18:38:51获architecture只读SOURCE_REVIEW无P1/P2，仅静态意见不覆盖完整外壳。新9个fake case与1个实际case分开配置，不默认跑实际。

唯一实验契约为1 runtime/capacity1/active0、至多12空claim、默认poll500ms/request1500ms、15s含自动清理与CLI、2MiB。测API issued/settled而非物理磁盘I/O；吞错、轨迹/byte截断、未知close或未知journal不得PASS。活动ownTMP峰值为采样界限，不是OS quota。入口默认缺OPEN/固定inputSHA/executionHEAD立即停止，未来仅Mika明确指定唯一窗口才允执行。

`execute-idle.mjs`只启动1个Vitest进程组，Vitest再启动1 worker；public runner只有该worker里的1 runtime。13s TERM、14s KILL、14.3s停止等退出；只有确认close/groupGone/stdio且内部journal已清空才删除新root。未知group/root身份保留。`outer-result.json`是pre-final-persistence快照，CLI在末次写入/计数后生成；完整Node物理exit和Shell全过程wall由外部receipt判断，不能从case绿/内部elapsed推整个15s成功。

未来检查应首先只开定向9fake与局部strict，使用既有Node24.20/Vitest4.0.18/TS5.9.3，无安装/SDK/PG；cache与TMPDIR须own，`NODE_DISABLE_COMPILE_CACHE=1`且无NODE_COMPILE_CACHE。actual单项及薄外壳须另审/另OPEN。若失败保留原始raw，无自动补数或重跑。

当前claim `508f9c85-a27c-4382-bfe9-caca43be4b0e` v2保留，原S01 plan/status唯一事实源。旧A/B、128及未知历史journal未读写；准备批准不等于容量/SLO、provider或本原大task已完成。
