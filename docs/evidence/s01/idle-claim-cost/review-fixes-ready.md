# Idle claim 三P2修复候选

Source `a41e5126a6e5df12b140afe2db7a274fac6ced43`；[增量manifest](review-fixes-manifest.json) SHA `e54265e157900983828d41b3a07f84aeb7268d6e0973340099f77f16179be763`。[新input](fixed-input-v2.json) SHA `9123a741cb27c999c28d55211a89cc98510c2553ed3f4be96b6e37b9a8b699bc`，79文件388750B +清单17630B =406380B，逐Git source=WT/hash，无错误。

原0de832/380666为CHANGES_REQUESTED；旧fixed-input、preparation-manifest和preparation-ready原字节保留，不能用新包改写其历史。以下是owner修复候选，仍待独立复核；fake/types/语法/actual全部NOT_RUN，窗口NOT_OPEN。

- 最终sample明确返回同root dev/ino及完整样本；任何失败返回null，阻止读取case和删除。只有close/groupGone/stdio结束、最终样本、经过身份校验并已保存的case receipt与`finalJournal=EMPTY`才清理已运行root；未启动root仍须最终样本/同identity。未知保留路径及known dev/ino。
- 预约目录/文件和采样后，在spawn紧前再核原起点的10s workAllowed；不重置时钟，不将10–15s迟启误称未启动。
- stdout/stderr截断后继续累计实际observed bytes，超过16KiB部分额外计费；未确认完整close/stdio/inventory/case的总账明确unknown/withinTotal=false。截断后尾流不会被固定预留掩盖。

补齐唯一路径只读 `tsconfig.json` 614B进入input白名单/预算，未改根文件。统一resource floor1107296256B，实际仍需future freshgate。

整体仍15s/2MiB。按Mika明确允许，在总额内预扣256KiB reserve：128KiB自动run/raw/capture/CLI，128KiB人工档案。[单一archive-ledger](archive-ledger.json)列出完整plan/status/review和本片新检查、审查、最终归档路径；当前与末次检查按整个文件计数。旧准备资料另已计入固定input，新增未列文件不能默认包含。raw保留原console16KiB、case64KiB、outer/CLI8KiB上限；没有为了旧分类压缩有用raw。case/result用compact JSON保留字段，超限仍失败。

外部Shell物理退出、完整wall和最终归档核算仍必要；pre-final结果不是终态。没有新增监督器、生产修改、provider或unknown journal访问。9fake草稿仍未跑，其中预算预留期望按256KiB更新；原early731静态审不覆盖本增量。
