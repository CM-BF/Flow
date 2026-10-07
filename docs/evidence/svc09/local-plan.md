# SVC09 本地连续验证段

复用P02已封存local.py的资源/记录方法和固定OPS14模块（725bad…），只替换本任务Node内置test的显式选择，不复制监督循环。全段实际监督累计≤180s；每进程≤30s work+.5TERM/2reap；tmp≤16MiB/raw累计≤2MiB；fresh≥1GiB+18MiB，结束live≥1GiB。记录最终空间采样是末样本不是瞬时峰值。普通小文件串行fixture各自清理，节点上限4096/采样≤1s；未知仅KEEP不强删。每轮source固定或在记录中精确绑定；失败原件保留，只补受影响选择。

选择policy（新配置/retention+原env直接消费者）；release（报告/指针/保留+原静态SSE直接消费者，合成loopback无PG）；host仅SVC09|SVC08（原真实PG前六例均不选择，仅注入process ports）；snapshot仅SVC09（原build例不选择）。0PG/provider/Chrome/安装/构建/个人目录。依赖仅已装pg8.23.1/Vite8.3.2两ignored link，见dependency-view；无donor写入。
