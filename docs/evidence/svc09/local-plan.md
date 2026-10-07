# SVC09 本地连续验证段

复用P02已封存local.py的资源/记录方法和固定OPS14模块（725bad…），只替换本任务Node内置test的显式选择，不复制监督循环。全段实际监督累计≤180s；每进程≤30s work+.5TERM/2reap；tmp≤16MiB/raw累计≤2MiB；fresh≥1GiB+18MiB，结束live≥1GiB。记录最终空间采样是末样本不是瞬时峰值。普通小文件串行fixture各自清理，节点上限4096/采样≤1s；未知仅KEEP不强删。每轮source固定或在记录中精确绑定；失败原件保留，只补受影响选择。

选择policy（新配置/retention+原env直接消费者）；release（报告/指针/保留+原静态SSE直接消费者，合成loopback无PG）；host仅SVC09|SVC08（原真实PG前六例均不选择，仅注入process ports）；snapshot仅SVC09（原build例不选择）。0PG/provider/Chrome/安装/构建/个人目录。依赖仅已装pg8.23.1/Vite8.3.2两ignored link，见dependency-view；无donor写入。

首轮policy10/release9通过；host18在fixture初始化就被既有STATE_MUST_BE_OUTSIDE_SOURCE拒绝：原caller将TMPDIR置于WT own evidence。生产保护正确，未进marker/process业务。仅caller改为系统TMPDIR下exclusive self目录；原raw与失败0B目录KEEP，已绿19不重跑。后继只host18+未运行snapshot。


后续仅artifact-slot、host-policy和maintenance-policy直接选择：新增受信build port写自有tiny文件而不Vite构建；maintenance/CLI完整源码通过Node VM链接内存ports，0PG/真实服务spawn。VM实验警告保留。原参数为空的bootstrap接缝仅补同3维护例，未跑旧6真实PG测试。

最终5轮共44 distinct通过，72选择（18原红计入）；7056ms累计监督/51959B raw，10组最终absent/双EOF，9个exact tmp removed。原首轮0B host-tmp KEEP以及原unknown观测不涂改；计数原件与每轮sourceRef见local-summary.json。实际未运行PG/构建/安装/个人操作。
