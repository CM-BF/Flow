# 固定6c诊断产物实际结果

实际一次新目录离线构建与内部加载通过；作者结果待独立审查。入口source `269034c2d07bad564e35469bc8a7e0d0094e9b78`，产物source `6c0fdcda8858aac33489c48c1948e902dd6a3d7e`；未重跑旧c2c构建或r1宿主。

- 实际开工 `2026-10-07T10:12:06.871Z`，持久结果结束 `2026-10-07T10:12:40.145Z`；entry 33273ms，完整监督 33332ms。
- Artifact `7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920`，自有根 `/private/tmp/flow-svc06-diagnostics-artifact-Snq8cV`，身份与三个私有原件摘要见[result-analysis](result-analysis.json)。
- 离线pnpm选择7importer/271snapshots、downloaded0；33SQL逐字核验；15628entries/363845121逻辑B，加manifest共367041727B。该数不是物理占用或回收量。
- 内部server/runner/preview/maintenance及diagnostics加载、SDK/native布局和固定Web只读选择通过；诊断导出与64KiB常量核对，无诊断文件创建。factory/runRunner/native binary/provider调用均0；无PG/host/浏览器/个人操作。
- outer exit0，owned组62953最终absent、双EOF、signals[]、first_failure=null；初EPERM/unknown观察原样保留，不改写为全程已知。持久result与outer stdout逐值相同。
- fresh执行时可用23205695488B，67次采样最低22758543360B；卷可用量下降447152128B含其它写入，不作独占物理峰值证明。raw加原producer副本合计15077B，低于2MiB。
- prepare.lock/临时stage目录不存在，producer记录cleanup=complete；成功artifact/root/原stage JSON保留，未删除。重窗口在确认监督结束后立即归还Lead。

[独审准备批准](independent-review.json) / [执行前置](execution-preflight.json) / [唯一outer原件](build-once/outer-report.json) / [持久result](build-once/actual-first/result.json)。本次尚未证明真实诊断host就绪、旧runner首因、迁移/策略/三App兼容或个人部署。后继仅复用本产物与原r1方法，需固定新namespace和诊断观察输入。

Clean-code安全点：无产品/监督器变化；结果提取只描述原raw，primary、初unknown、资源/证据保留分别记录；不为产物成功抹掉r1失败。
