# K01 首次真实检索诊断：FAILED / HOLD

唯一窗口执行源 a82e44be17a7a31b051bf98400d9553513600542，实际 HEAD969b25b49b646d1f09c6059621dbc9b88aa8a9a3。16:44:58.670157Z 开始，16:46:51.872606Z 返回；operator113081ms/监督112936ms，未超过120s总界。

OPS14记录真实 work DEADLINE_EXCEEDED，随后SIGTERM sent、exit -15，最终owned_state absent/MERGED EOF完整0B。first/secondary异常仍使resourceConfirmed=false；不是此前只读EPERM初观察被误判的情形。没有FULLRETURN，也不因最终PID闭合推断数据库已归还。

唯一新库 flow_k01_query_2d8516c466264673bb3417de0c349ec1 已有CREATE ACK、OID1336476、owner与marker的持久回执；result/cleanup缺失，因此数据库和精确scratch均KEEP，不普通DROP、不FORCE、不补探针/重跑。复制到本目录的四个身份文件来自本次唯一namespace；旧.local/KEEP未访问。原iterations/raw逐字保留。

没有持久金样本结果、EXPLAIN计划、SELECT样本、HTTP次数、DB末大小或连接峰值；这些均UNKNOWN，不把0 retained解释为0执行。尚不能定位停在factory/listen/measurement/cleanup哪个阶段，不猜根因。原设计与纯结果批准仍有其范围，本次实际运行失败不冒通过。

经理后到事实：W01 ordinary strict16:45:35.498477→16:45:37.148418，compiler6181/outer5981 exit0、1650ms；FULLRETURN16:45:54.467272。与K01真实重叠，不能声称独占CPU或洁净性能基线，也无相位证据排除影响。

本次唯一admin准入读在主体前闭合，max100/占用9(含自身)/保留3/可用88≥18配置+16余量。该0.096130s前置墙钟单列，不延长主体120s；初配置文件未物化的读取失败发生在任何child/PG之前，后从同固定Git取合法来源，详情见../query-pg-first-admission.json。

当前窗口已消费且STOP；下一动作由Mika协调原身份资源恢复与窄只读审查，不能利用剩余许可重跑。
