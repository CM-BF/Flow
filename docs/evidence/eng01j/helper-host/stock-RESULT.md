# 单次 stock helper 结果

获审caller `d44c1bc2c48f96145a519b64f9220baf468bdee8` / 准备delivery `d2efbf5e3890f3d755c9a65e74f7c9ef109499ad`，产品仍f15。执行前fresh claim v1有效、22输入逐hash一致、原树clean、stock-run-once不存在；余量24,370,835,456B高于原线。没有安装或旧检查重跑。

唯一实际执行 **PASS**：outer exit0，总574ms；准备Node310ms、stock100ms，raw268B。固定0.154 binary经sandbox-exec/旧exec-only接收一行fs/writeFile，返回精确成功JSON。预存calculator.mjs保持原dev/ino并从0变为X，baseline.txt仍0，workspace仍仅原两个文件。结果中的writeAccess为unknown。

两子组最终absent、双EOF、无信号、无primary failure；原EPERM历史观察仍保留，不把它自身判为absent。先持久checkpoint，然后仅原dev16777234/ino123593772 scratch正常删除；私有末采18,923B，14份原run文件28,658B。时间字段startedAt是固定输入核验之后、子阶段之前记录，最终06:44:31.242028Z；574ms的monotonic总时长还包括此前固定输入读取，不混成任务壁钟。

本次只证明**独立初始exec的stock单文件请求**与派生recipe在该fixture相容。没有app-server派生、模型请求、provider、PG、浏览器或个人服务；不签NativeWriteAuthority、不证明全部writer可撤销。host.observe闭包没有跨准备进程伪恢复，实际文件/响应观察来自实验caller。动态库入口绑定不等全系统attestation；私有bytes为末采，非连续峰值。旧shim/stock/pagesize失败全部原样保留。

[原始结果](stock-run-once/result.json)、[清理前checkpoint](stock-run-once/checkpoint-before-cleanup.json)、[固定caller输入原件](stock-inputs-executed.json)、[限定分析](stock-result-analysis.json)。原输入binary的“Preparation hash only”是继承文案；当前stock-inputs只更正阶段/use，绑定与原已执行输入摘要不变。caller及四产品未修改。结果待唯一独审，不追加运行。
