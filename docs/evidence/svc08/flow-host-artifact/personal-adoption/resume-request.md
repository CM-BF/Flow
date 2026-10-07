# 只续接请求的固定入口

实现 `c20d21b21caba504cd472c4596110fe535980752`，base `72ebf2eee8560541680fd5fb304485f5922f7900`。r2真实迁入成功、request原失败不改；Date修复472a和r2结果均已有独立限定批准。r3只是输入声明，未建立或执行。

唯一执行链仍为既有 supervisor 的 `request` → `replace` → `post`。当 inputs 明确 completedMigration 时，migrate 在外层及 caller 两处拒绝；request 独占创建新的0700 r3与新的operation ID。不存在旧成功阶段的隐式重试，也不将旧outer复制成r3的新阶段成功。

`readCompletedMigration`仅读r2五个固定文件：reservation、migration-result、migration-checkpoint、migration-before、migrate-outer。root必须原dev/ino/self/0700/真实目录；文件必须regular/self/nlink1/0600及精确dev/ino/bytes/SHA，限64KiB/个。成功结果同c7b、先行checkpoint标记、outer exit0/no primary/absent/双EOF/原migrate complete全部明确才交回原before；异常不改变旧文件。

新request在现有preview锁内先核store原dev/ino和已迁入artifact完整原verifier，再读fresh facts、规范化唯一维护时间、保所有原身份/版本/retained/业务只读和CAS门。原r2 before作保护锚，写独立completed-migration-verified来源记录，不复制旧outer。仅新request明确成功才允许一次原CLI replace与原post。没有调用clone、rename、ensureStore、drain、任务或模型；两锁仍由既有helper finally释放。生产工具/后台af51 v18/Web d629 v3/三个retained与c7b不改。

预算仍按原每阶段：request20s+.5TERM+2reap，replace28+0+2 PID-only，post20+.5+2；三段政策合计75s，外部准入/结果持久化另如实计时，不称全流程硬75s。fresh2.5GiB/live1GiB/raw2MiB门不降。本次不再迁入，已保留artifact/stage不是新复制；成功阶段不得自动再跑。未知停止并保留r2/r3，不回滚/覆盖/换参数。

5新tiny checks覆盖精确五原件读取无变化、有效JSON篡改、root/file身份与缺件、旧失败/unknown/不完整EOF、未知迁入/错artifact/错checkpoint。191ms/raw645B/3组absent双EOF、checkpoint后exact临时目录removed；另外caller语法与原supervisor AST实际guard验证，不执行supervisor顶层。加Date139ms后本段累计330ms/raw1205B；原9/6/Date5无重复，0PG/HTTP/个人读取/provider。实际r3仍未执行，等待唯一Lead审查+共享窗口和16工具短冻结。
