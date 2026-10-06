# native-pagesize 准备质量记录

模型gpt-6-astra；本段沿本地find-skills/brainstorming与用户固定clean-code sickn33 bdacd76，无安装。职责限定C采样、固定host顺序、惰性entry；process/TERM/KILL复用runOwnedCommand，compiler词法复用既有parser，生产R06不改。

Mika 2026-10-06 18:07:46 UTC SOURCE_REVIEW APPROVED：production fd2f59405dc5f8735dea649a357ba1d23b7d8bba / C与两policy fde671c9 / test a3954e0c / config91b8be7d，0P1/P2。architecture_read辅助C/A/B、entry/outer及deadline修复；不是重复执行批准。

首检查18:05:19使用错误WT相对Vitest入口，exit1/0tests，823B原log保留，inert/sh未运行。只读复核旧已成功native检查后，显式复用main已有Vitest4.0.18绝对入口及exact alias，无node_modules写入。

重新授权的18:07:10.830527→11.716048 UTC检查，0.885535s：10 selected/10 passed/0 unselected；Node24惰性import spawn0/listener0，sh -n exit0。3326B原log SHA9aff6d14affcf388ad8378a46ccce0ab0665f948ff0f9fb5d6b7a86163dea45d；与初次823B累计4149B。7个fake父根有即时identity、afterAll同inode清理；独占cache146逻辑B/4096 allocatedB及TMP0B均同inode删除。3直属harness自然exit0/stdioEOF，后续exact PID group核均absent；未观测全部历史后代PID，不写0 harness process。0实际clang/helper/native/listener/PG/provider。

10项覆盖负页值有效、positive/errno与pthread分开、非法nonce/PID/字段/完整性、同binary A/B参数、unknown-close不遍历/删除、compiler诊断写失败保根、helper副本失败保原stderr、最终result失败保known identities、slot-fsync跨启动cutoff零command、共享clock过线零command。旧executor无源码变更，不重跑无关历史检查。

源格式/命名/职责/错误边界自检：无新重试/FSM/权限；slot落盘后再次查cutoff，TERM/KILL余量与四秒收尾预留；所有partial write记账、收据先预判32KiB；清理unknown保身份。新证据与旧native fcd/7a72分开计量，旧344B仍KEEP。最终prepared/runtime/外部/归档包尚待独审，actual NOT_OPEN。
