# SVC06 个人连续窗口 R2：部分完成，维护前停止

本次窗口 `svc06-personal-7d1-20261007-1230`，固定迁入 source `5c29e13a`、产物 `7d1` / source `6c`。12:29:20 实际 fresh facts 通过；迁入 12:29:53.364 开始，23,649ms 完成。上一 R1 的 OUTPUT_REQUIRED 原失败不改。

- 迁入成功，完整产物保留；原 c7b 不删除。clone allocated/logical 与 exclusive physical 不等价。
- Web-only replace 一次 ready / replayed=false，16,689ms。新 Web PID/PGID 89438；旧 22704 group absent。center/runner 原记录、后台 af51/v18、config/profile/maintenance/pointer、任务与 64 表 protected 摘要保持。
- 三份 C3 v2 报告导入与 205B 私有 browser-session 策略写入完成，合计 4,289ms。策略是磁盘配置，尚未完成新后台启动或启用验收。
- 维护前补充旧列摘要的 inline 只读调用在 ESM 静态链接阶段失败：直接 CommonJS `pg/lib/index.js` 的命名导入 `Pool` 不成立。62ms / exit1 / owned absent / 双 EOF；模块正文未执行，0 SQL。此为操作者观察入口错误，非固定迁入产品失败。
- bootstrap / refresh / ready-paused checkpoint / resume 均 NOT_RUN。12:35:37.013 立即归还共享窗口；不重试、不回滚、不取消任务、不清 journal、不执行模型。

完整事实取 `fresh-before.json` 与 `after-replace.json`，stdout 仅 helper 摘要。`migration-raw/` 是原件逐字副本，原 `/private/tmp` 文件和已迁入产物、报告、策略全部 KEEP。停止后未新读个人或发 HTTP。后继只能 fresh 核既有完成阶段后继续维护，不得重放已成功四阶段。整体 SVC06 未完成，结果待独立审查。
