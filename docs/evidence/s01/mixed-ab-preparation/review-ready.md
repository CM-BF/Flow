# S01 A/B preparation review ready

Review target commit: `da93263a1f47039abcfe7d20670cc2040c457136`

Owner status_read/gpt-6-astra；权威runner-capacity-probe，claim508f9c85 v1 ACTIVE四scope。implementation已固定，窗口NOT_OPEN。manifest SHA `a06e0d3cd2d839b47b033df929f39ecb3e9a7b654bcbbab132bbd62959f732a7`；35source/5readonly/39raw/8support逐targetGit=WT/hash/bytes；6runtime和11不同外部依赖manifest现场匹配；A/B977 fixedGit blob入口与精确生产diff另核。旧26原source按6de/c259逐Git核，当前6源fixture/接线变化明确；旧raw仅核Git tree无漂移，未读128raw/FKye9L。

61distinct=19new+42legacy最终选择覆盖；59选58绿1旧SQLfixture红→定向13绿（含2新deadline）→输入依赖5重叠复核绿；strict0，失败全保留。新两侧生产未import/export/run，当前仅pure/fake。

重点review：固定包声明解析与pg prototype、共享实时byte/task账、pre15s与侧135s绝对deadline、A完整资源确认后才允许B、unknown保留、CLI+外部完整wall约束。每侧128fixture/session，A→B固定顺序+背景噪声不作SLO/speedup；最终实际磁盘条件未满足，不因准备APPROVED开启窗口。
