状态：CHANGES_REQUESTED（固定原设计2 P2；当前修复待增量复审）

Review target commit: f2884fa869ff231278e8116ddefa0e1029440eca

chatui原固定review经Mika交接：5bindings26145B/17inputs168222B/hash相符；主体双phase、分帧、private opt-in及发布方向可行。唯一2 P2：resource receipt缺累计入场/有界恢复与FS安全；16KiB console cap不能防input/config泄露。此非产品实现批准。

本次新段12:50:25–13:00:25 UTC，只改计划/Interface：固定32槽/260KiB表示门禁、FS身份与重启有限读取、unknown全root HOLD及正常清理复用；诊断只drain/discard+bytes/EOF/固定安全code。待固定后由原reviewer只审delta，0工程运行。
