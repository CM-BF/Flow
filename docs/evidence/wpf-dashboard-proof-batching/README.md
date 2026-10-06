# WPF-DPERF02 有界 Git 测量

固定源码 41315b033deb0b1953484359b686c0b228997367。只测临时 Git 仓库/少量临时 worktree，16/64/128 注册来源。总运行含清理不超过60秒，证据不超过32MiB；不访问4320、个人服务、产品DB或模型。先记录 Trace2 Git starts、峰值并发与墙时，再判断最窄优化；synthetic128不代表runner/provider容量。

[原子领取](take-receipt.json)、[初始账本](take-ledger.json)、[技能](skills.json)。实际脚本与结果随后在本目录保存；当前无实验结果、无生产变更。
