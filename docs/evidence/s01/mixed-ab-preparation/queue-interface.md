# 固定生产基线的交付策略对照：配方接线片

Source `130c6ec855db850a817312623742cf14e8b45135`。准备源码与局部结果可独审；性能 **NOT_RUN / NOT_OPEN**。本片还不是实际运行准备批准。唯一 [45项交审清单](queue-review.json)、[单份局部记录](queue-local.json)、[前片P2原审查](pg-wiring-independent-review.json)。生产基线固定 `4fdd856293a502209d7509ea37da901bbfd89f72`，不追 moving main。

## 本片真实职责

| Module | Interface / 不变量 |
| --- | --- |
| queue-probe / run-identity | 仅两个有限身份 O1/O2；同一生产基线，区别仅 per-query / buffered 交付。每侧129任务（已完成聊天1+128 fixture），总258；原A/B常量/默认128及历史输入、原件保留。 |
| ab-driver / ab-budget / ab-input | 复用已有顺序、单绝对300s、15s准备、135s/侧、512MiB累计账与失败停止；新入口动态import也在计时内。固定Git导出一个sourceDirectory给两侧共用，沿原包链接方法；16外部manifest（新增已有tar7.5.22只读绑定），不安装/另建监督循环。六关键源逐固定Git绑定，全部快照运行时由固定Git blob核验。 |
| queue-chat / driver | 公开conversation→turn→bearer identity→v2机会领取→5种持久事件，建立1KiB合成已完成回复。复用生产codec；绝不运行Claude SDK、native或新业务adapter。随后交替真实conversation/detail与turn page读取，逐响应核同turn/task/attempt/digest/正文；≤2在途、≤200轻读。 |
| child / queue-proof | 测量固定6s；发射活动最多再4s，给已发操作1s收束余量，实际adapter-end必须不晚于本地起点+11s否则无效。测量结束后driver先重新核四个固定task同attempt/owner/live，再发四cancel；不取消已经完成的任务。runner直接记录control.signal abort，禁止此后新的emit-start，已在途ACK保留。 |
| observe-pg / child boundaries | opt-in仅增启动/settle标量，phase边界取center本地snapshot；全观察pool集合，不冒center专属到达队列/checkout hold。runner同时记HTTP、emit在途数。原计时、promise/错误/this/callback与生产池配置不变。 |
| queue-journal | 只有已验证全部129持久task/attempt与正常runtime drain之后，才把本注册runner的严格v2空assignments、合法opportunity识别为干净；未确认、旧v1 unknown、foreign或非空仍KEEP。不是放弃未知旧journal的恢复授权。 |

HTTP硬计数每侧owner/protocol 512 + runner7680 = 8192；每次未知提交/请求也占数。真实读取返回体沿原256KiB cap，IPC完整信封沿前片64KiB。每侧135s/240MiB，共同32MiB已含4MiB最终reserve；O2要求O1成功且全部资源已闭合、剩≥150s。边界溢出/计量丢失/summary缺失均无效，不以旧A/B cap余量当新配方通过。

取消统计分三个同钟量：driver send→ACK；runner signal→adapter-end；driver send→最终持久状态首次验证读（是观察上界，不是精确commit时刻）。ACK→signal跨钟值与该区间精确emit数明确UNKNOWN；所有传播期间emit保留，不剔除。HTTP issued/settled/errors/missing分别记录，边界在途样本并不证明全时峰值。中心/runner同epoch各自本地窗口没有被称为严格共同6s。

资源沿原driver正常close/DROP，不扩权：新recipe在CREATE请求前耐久预约；ACK后核OID/随机marker，DROP前再核身份和零连接；不确认即KEEP。自建runner目录立即记录dev/ino，删除前核同identity，后核absence。子进程由同launch加入owned再耐久checkpoint，发送配置前等待checkpoint；外层仍须现有OPS14给整个process-group/EOF收尾，不能拿本纯检查代替实际PG生命周期证明。

## 前片P2与实际局部证据

chatui 13:03:04 对 b846/41ca 的唯一P2：首次unavailable没有保存历史tuple。现在独立保存detached history及live-key集合：历史不等于执行资格；同key改tuple/empty/missing回退拒绝；同tuple首次assigned是first-live，其后才replay。该直接反例本轮已通过，正式P2关闭待原reviewer复审。

本段12:59:40开始，截止13:19:40。前半source-only，root交还ordinary后13:11:27.291241Z开始5个child，最后工具13:12:46Z确认全部closed。类型首2（742B，rows推断与动态入口缺export），窄修后0；新recipe4+P2反例1共5pass/9未选，再新增boundary透明性1pass/14未选，最终strict0。**6 distinct分轮，不是最后6例全跑，也不与旧11/9/64相加。** 原失败及每次source/raw绑定保留。

5raw1635B；supervisor累计6823ms，不是外部wholewall。五组末态ownedabsent/MERGED EOF/完整捕获，各自same-inode有界末样本后TMP删除，早期EPERM及首失败保留；peak/wholeexternal未知。fresh各child使用6,934,233,088B下限，未退回旧KEEP或重复reserve。没有PG、HTTP listener、runRunner、provider、安装或历史unknown根动作。

## 后继准备门槛

`queue-main.ts <window> <clean-execution-head> <complete-fresh-floor>`复用同outer，但**当前不得调用**：`docs/evidence/s01/pool-wait-run`未领，不曾创建；还须新scope原子amend、完整runtime/动态SQL与实际依赖/外层监督输入清单及manager资源总账/独占交接固定并独审。代码中最低资源值只是防误用下限，不是未来manager完整sum；512MiB和PG/WAL额度不可重计/当硬cap。没有合法OPEN不运行、不借个人后台窗口。

本片验证是私有纯模块与接口形状，不证明chat真实HTTP/取消传播/128持续/新基线PG能跑通；这些实现已接真实路径，仍需下一合法专库运行验收。原ACK/browser/native完整TODO与整体S01 NOT_COMPLETED继续保留。旧AB两PASS不证明一致延迟收益，当前也没有新的性能结论。

## 质量

2026-10-07T13:13:57.662728Z owner固定前复核：复用已安装find-skills、brainstorming（既有f0f56已批准设计）、codebase-design、sickn33固定clean-code，不安装。策略常量/合成chat/public证明/严格journal各有真实调用者；生产权威仍为server/FlowClient/AttemptControl，未复制adapter或第二监督器。可选字段保持旧默认；错误不吞、跨钟不相减、历史与live分离。当前源码及资源增量仍待独立审查，不把owner质量记录当APPROVED。
