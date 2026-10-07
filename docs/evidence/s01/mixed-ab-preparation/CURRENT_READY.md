# S01 已消费性能准备入口

**CONSUMED / O1_FAIL / O2_NOT_RUN / NO_RETRY**。2026-10-07唯一窗口已执行并归还；当前结果见 [pool-wait-run/report.md](../pool-wait-run/report.md)。下面为原准入前固定历史，不能再次用于启动。

**历史 CURRENT_READY_FOR_MANAGER_HANDOFF / NOT_OPEN**。记录 2026-10-07T13:58:41.052Z；当前canonical为 [CURRENT_READY.json](CURRENT_READY.json)。新许可尚未授予，不因ready启动PG、HTTP或性能。

源 `375ecccc427acf59d687153903bd032fb6e684bc`；固定生产 `4fdd856293a502209d7509ea37da901bbfd89f72`。input-v2 SHA `970f071eb7eb275145c81a6b6d0f6193ed5737c6e0a2b48051ada414f3819512` 原字节不改。最后实际pure execution `3bd8f7e6649569a385cf67c5ec79d99673a7e5fc`，结果 `3fdb488064a3414d4ad9903667253e06aa23f7c7`；本次freshHEAD/origin `01515ba961a80fa6a3dd761d5b3ab2a670fb0a1c` clean。收口后的metadata HEAD以实际Git/提交交付读取，未来执行必须由manager固定40SHA，不自动取movingHEAD。

claim508f v3 ACTIVE/full6/原owner已fresh核；五caller输出（reservation/spawn/stdout/stderr/outer）和pool-wait-run根本次exactlstat全部ENOENT，详见JSON。不访问任何旧unknown根。

两次独审：db13:51:11源APPROVED，环境P2 CLOSED；db13:54:42结果忠实性APPROVED/0P1P2。5selected/5pass仅合成env与clock，原raw787B、单child/EOF/TMP清理与初EPERM记录不改；不重跑，也不是实际queue通过。正式结果[回执](queue-operator-env-result-independent-review.json)。

未来floor至少 **9,296,871,424B** = 最新manager7,686,258,688 + 实验536,870,912 + DB/WAL headroom1,073,741,824，取manager更高完整sum，cleanupreserve只一份。旧input最低9,125,888,000仅历史保留；实际参数必须用新更高值，不改input。reserve不是WAL/heap硬cap。原300s/512MiB、15s prep、两侧135s/240MiB、共同32MiB含4MiBfinal、O1成功完整cleanup且剩≥150s才进O2，全不放宽。

[显式env-i/Python-I-B入口](queue-operator-env-ready.md)仍适用，但future floor参数须新完整sum。Original三个个人服务常驻及曾running用户负载的后续状态UNKNOWN；不探/停个人数据，不从未回传推断结束。共享背景不是两arm受控常量，本次结果也不预断SLO/稳定提速。

本段只metadata，0tests/PG/HTTP/清理/安装；原taskstartUNKNOWN、六TODO/整体NOT_COMPLETED、历史main接收边界保持。源码/输入/旧manifest/raw已停止写入，claim保留等待manager排队后的明确OPEN。
