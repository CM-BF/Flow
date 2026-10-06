# MATURE02C01 独立审查

状态：NOT_STARTED
Review target commit：563b1ea151d8d26a2100238d8faf26b697f38d71

作者 native_center_owner，独立 reviewer 待 ExecutionLead 指定。基线 8e9b35233e5b1e93df19e2ea802e0f2fbefc23f6（受控 CORE/F01 输入）。源码范围为status的9个literal；[作者证据](../../docs/evidence/mature02c01/README.md)、fixed-manifest.json固定后供只读核验。

可复制审查任务：只读核实际树/head/dirty与固定manifest；读新目录严格protocol及旧reader保留、嵌套请求冻结/ACK未知映射、requested/observed关联、opt-in queue immutable receipt与最长完整字符预览、CLI稳定key/有界文件读取/退出码/signal；核原raw与未运行界限。CORE/F01受控输入不因本片审查自动获批准，不重跑无关全集。

作者实际验证：86不同用例分轮通过，67既有直接消费者、19新用例；三轮 focused types exit0。未执行：root types/PG/provider/browser/真实Web或TUI旅程。独立审查尚未执行；当前记录不是批准。

源前检 P2（ExecutionLead）：8bf472e3265f0995db2c5503876859cc511a4dca 的queue接受任意短前缀；作者在 563b1ea151d8d26a2100238d8faf26b697f38d71 修复为与CORE itemView相同的最长完整code point前缀。两条定向回归由2红转2绿/6未选，focused types0；等待本目标完整独审/确认。原raw保留，未重复82项矩阵。
