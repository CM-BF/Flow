# Native catalog probe 工作段

设计7e9bd5b2获Mika 17:17:20批准；功能checkpoint c072b156，随后469e97eb仅加强测试fixture创建即登记/同inode删除/清单，12项行为断言未改。沿本地find-skills、openai-docs、brainstorming及既定clean-code bdacd76方法：R06唯一进程owner、固定一页consumer、错误仅有限码、未知保留资源；不新增监督器或生产模块。

Mika授权的同一次小fake窗口于2026-10-06 17:29:53结束：12/12、Node24原生惰性R06/入口import、sh-n各exit0，总0.755876s。4raw共9147B、日志3796B，12个自有fixture父根均已删除并逐path核不存在；cache同dev/ino清理（640逻辑B/4096分配B）。Vitest线程/转换是测试harness；0诊断factory/native/listener/PG/provider。绑定[validation-manifest](validation-manifest.json)，不重跑历史检查。

当前实现审查仍有entry-reservation的P2：open后写/flush/close失败须保留预约身份、部分bytes/FD状态及准确targetCalls=0；待最小修复和增量检查。目录监测的并发替换限制另由Mika裁定，不擅自扩大为文件系统框架。真实go-native-catalog-probe-once仍NOT_OPEN。

17:35增量工作：依Mika收窄，活动期只核两个root身份，完整walker以bufferSize1逐项读取且仅前/确认close后；未知close不碰target control。entry预约立即登记、失败保身份与0target，原complete/partial/final receipt传播沿同结果。新增4项与受影响inventory1尚未运行，等待单次小增量准入；未以12绿掩盖entry P2。
