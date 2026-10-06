# S01 event-state A/B preparation

当前只交付准备。候选 `s01-event-state-ab-once` **NOT_OPEN**；实际资源条件尚不满足。固定输入A3e/Baae，仅events生产差异；共用mixed+c259observer。具体[Interface](interface.md)、[检查](checks.json)、[质量](quality.md)、[生产blob输入](production-inputs.json)。

61distinct=新19+旧42；59选58绿1fixture红，修该fixture后13定向全绿（包含2个新增deadline反例），strict0；不是单次61/61。所有原始失败保留。0实际PG/HTTP/runner/provider/SDK/128，未做fixed输入导出预演。

拟实际命令（只有Mika明确OPEN exact executionHEAD后允许一次调用）：先静默source批准env、映射FLOW_S01_ADMIN_URL，再以Node24+tsx执行 `experiments/runner-capacity/mixed/ab-main.ts s01-event-state-ab-once <exact-clean-execution-HEAD>`。外部 `/usr/bin/time -p` 同时记录物理进程全寿命，stdout/stderr写本新run目录外的本次自有CLI临时文件，结束后safe收据与字节归档计入4MiB共同reserve；不提前创建run目录，否则唯一reservation拒绝。该命令不是运行许可，不执行旧launcher。

硬上限300s/512MiB、pre15s、A/B各135s/240MiB、B开始余量150s；总256独有fixture tasks/attempts、8runtime×16每侧。同一driver进程，顺序2×(center+runner)共4child实例。每侧6s、2Hz等旧128节奏不变；不制造warmup/重试补数。FAIL/UNKNOWN保留original输出与resources，B可NOT_RUN。

源副本根据固定Git导出（A488/B489文件，逻辑3295449/3318995B），源mode仅regular blob； workspace links依据真实package声明指向自己的export、外部依赖要求当前固定version，pg原型与已审六runtimehash另核。byte口径为可见Git输入/导出/Node流/IPC/证据，非全部OS I/O或PG磁盘。4KiB估算文件分配仅估算，不作共享空间保证。readonly main后来plugin/P06变化不在本A/B输入内。

原source6de/c259与128result64911/prep/原manifest维持fixedGit历史；新source另target。新manifest需绑定所有当前mixed源、parent只读、runtime与A/B fixedGit输入；不把旧27readonly说成新main未漂移。

2026-10-06 14:01:01 UTC final dependency refinement: only15 already-declared external dependencies are linked in owned export roots; fixed ab-dependencies.json binds installed realpath-relative target, exactversion and manifest SHA/bytes. zod4.6.5 is reused from the existing contracts installation because the old server/interaction directories lack their declared links. No WT node_modules/source modification, install, undeclared alias or SDK code import. Five fake input cases (including hash-mismatch refusal) rechecked, same61distinct, latest strict0. First source checkpoint98ae is superseded by final input-binding source; oldsource/raw remain separately fixed.
