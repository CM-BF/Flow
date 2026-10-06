# DPERF03 验证与限制

实现 `5609ea719ec400a803bb6036429312b7a212c90f`，base `eb95fba43b0305db0dd40dfe85ccc0d58eb9a6ea`。[checks](checks.json) 原运行来源 `2a52b8ae5250781c712b71117ccd5321a6b4103d + dirty`，不是后来实现SHA上重新跑。[candidate](candidate.json) 五源码执行字节=current=固定Git逐SHA256绑定，13只读依赖与base相同；根manifest/lock未变。

## 已运行

- Node24.20.0；既有依赖离线 `pnpm install --offline --frozen-lockfile --ignore-scripts` 4.1秒，无新增依赖/lock变化：[安装日志](install.log)。
- [直接消费者](direct-consumers.log)：`node --test --test-concurrency=1` 显式 git-snapshot、proof-snapshot、proof-tree-batch、human-proof 四路径，37/37 PASS、0skip，25741.907042ms。10新受控+原27直接消费者；旧4个证明行为/次数/跨snapshot/unknown断言全保留，只将识别器改真实两SHA+固定flags+终止符。含真实MAXBUFFER/E2BIG/单scope错误/timeout不误分拆及独立调用兼容。协调DB环境变量在测试进程删除，无PG请求。必要旧消费者回归单列，不是本轮性能benchmark。
- [临时Git成功报告](experiment-1791288846658/report.json) / [日志](experiment-second.log)：1个有界实验内6场景，8 repo观察32starts；四proof实测23starts，其中dirty/untracked/末HEAD各1，其余20条保留。默认context Trace2 start-exit峰4；freshness、仓隔离、队列期间HEAD改变、fallback show、真实失败许可释放通过。自有临时目录已删除。
- 新tempGit两次累计 **2151.294833ms**（首1020.65975+次1130.635083，均含清理），分别cleanup12.895875/13.046916ms fulfilled。45秒总预算、35秒新工作阈值/至少10秒清理预留均未接近；第二次结束全evidence515053B，小于8MiB。[累计账本](experiment-budget.json)。必要消费者进程25.741907042秒与上述实验分开，若粗加两种壁钟为27.893201875秒，不能称全部时间同口径精确实验样本。
- source diffcheck0。没有browser/types/build/生产snapshot/真实registry/4320/个人服务/provider实验；Node测试实际导入全部变更JS，不为该改动跑无关Web工程。

## 原失败不覆盖

[初次契约入口](initial-contract-red.log) 因新Module尚不存在而失败，未进入用例，不叫产品回归红；[首次controlled](first-controlled.log) 因pg尚未安装而未进入用例。[10项受控初轮](controlled.log)与[最终受控](controlled-final.log)通过。

[首次实验报告](experiment-1791288831727/report.json) / [首次日志](experiment.log)：前五场景已取得，最后case脚本将execute原始带newline的HEAD与fixture trim值比较而失败。生产raw stdout符合Interface；修正仅测试端显式trim，原报告不改。安全点核累计1.021秒/cleanup fulfilled/剩余43.979秒后进行一次必要复跑，未扩实验。成功报告四个源码hash与当前一致；它不依赖后来第5个旧专测helper。

## 口径与边界

原管理研究四proof28条与本轮23条是同语义小样本调用量比较。旧研究原文可见[管理research](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/research.md)；两源与fixed eb95字节相同。没有重跑原DPERF01/02 benchmark。并发4是每context child资源政策，受控executor测active峰，Trace2只start-exit区间，不是OS存活普查/CPU归因或生产延迟/SLO。

mainChanges读取dirty与untracked完成后核HEAD，guard失败缓存为unknown，本次不重试/下一snapshot新读。查询不是Git原子快照；不能检出A→B→A、相同SHA换branch或查询间工作区变化。main.git.dirty早于scope变化查询，允许不同观察时刻。只缓存main观察Promise，未缓存完整proof或跨snapshot结果。独立调用分别新context，不声称多服务器/并行调用共享全进程上限。

独立review：NOT_STARTED。main接收/正式部署：尚无。
