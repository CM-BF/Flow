# S01 delivery replay v2：唯一当前源码准备入口

2026-10-07T14:51:05.201Z；固定source `d28166e81bcdbb9fb537b40144f7be07a2539130`。`delivery-replay-delta-manifest.json` 6 bindings / 62215B，固定新input-v2 `bf9127870db0d9d14087d679fea1eba4c5e217f440650665f6d376c9af1b0615` / 62 bindings / 18471479B。**DELTA_SOURCE_REVIEW_READY；compile/pure/replay全部NOT_RUN_NOT_OPEN。**

本15min段14:41:05Z开始、14:56:05Z截止，fresh508f v3/full6/本人、fd7f clean；0工程child/编译/import/PG/HTTP/Chrome/provider。旧bee/fd7唯一P2与原3pure未运行保留，18旧binding/input/trace原字节未改，原43MiB不再读；旧两KEEP不访问。

## 窄修边界

1. `process_closed(report,saved_raw)` 需要exit非None、finalabsent、明确MERGED/stdoutEOF、observed=retained=len(savedraw)、原capture字节完整、无secondary，first为空或仅CHILD_EXIT_NONZERO，signals均sent/absent。SIGNAL_UNKNOWN/CAPTURE/STOP/deadline不因末次absent而获得删除权。完整历史observations仍保存，早期只读EPERM不被抹掉。业务exit1仍FAIL；只有资源已完整closed才可精确TMP清理。新增合成反例覆盖这些字段和精确dirty路径，未运行。
2. 实际replay只`Node <generated>/delivery-replay-main.js`，worker `fork(...,execArgv:[])`。实际运行闭包精确六叶：main/replay/bridge/delivery/channel/contract，只有Node builtin/相对JS。tsc仅在后续普通准备中运行，strict/noEmitOnError固定；生成测试与type-only辅助JS只留自有TMP，发布六JS逐字副本+显式ESM package。artifact manifest绑定源inputSHA、六源/编译器hash、实际compiler argv与七文件bytes/hash。**当前产物尚不存在、hash UNKNOWN**，不把静态无loader方案当实测3PID。实际入口需外部固定manifestSHA及成功compile收据，0tsx/esbuild runtime helper；普通Vitest可能用其已有依赖，属于另一准备段。
3. 三pure顺序`caller→compile→tests`，整个固定执行HEAD不因产生已知raw而更改。下一mode重新验证前mode同window/head/input、capture/process完整、raw hash、reservation/spawn/root身份及必要生成物hash。只允许精确已知前轮输出为untracked；任何tracked修改、其他untracked、目录宽泛项/rename均HOLD。源码失败修复不是忽略dirty或清空原件；需要新固定target/明确接续方案。实际replay独立许可，先封存普通输出/JS使执行HEAD clean，不能继承pure许可。

## 明确候选，尚无普通运行授权

仅3顶层child：caller四个合成pure例；compile同时focused strict（原三files与直接类型消费）并生成JS；tests原新单文件8case。原三项从未运行，故不是重复green。每child work≤30s/whole≤40s，累计≤120s；raw每32KiB/总96KiB，TMP每2MiB/三份累计样本上限6MiB，准备新增逻辑候选16MiB。编译发布JS/package≤128KiB，manifest候选≤16KiB，纳原source/meta512KiB余额，不扩本段；不是heap/OS硬quota。

预定28文件及build root已列input：4mode各5个`delivery-replay-v2-<mode>-r1`输出+6JS/package/manifest，准备时全absent。旧r1 namespace不复用。本入口不自动改名、重试或重开旧窗口。

固定调用形式（**未授权执行**）：

```sh
/usr/bin/env -i FLOW_S01_REPLAY_OPEN=s01-observer-delivery-replay-once:caller /opt/homebrew/bin/python3.13 -I -B docs/evidence/s01/mixed-ab-preparation/delivery-replay-operator.py caller <CLEAN_EXECUTION_HEAD> bf9127870db0d9d14087d679fea1eba4c5e217f440650665f6d376c9af1b0615 <FRESH_MANAGER_FLOOR> -
```

compile/tests同时替换mode与OPEN后缀，末参数仍`-`。replay必须另得OPEN、传审核后生成manifest的确切SHA；它仍原60s/32MiB/两arm顺序，O1不完整不启O2。新source的实际生成/测试结果及caller资源门禁先独审，再申请有限段，不能拿“prepared”充当PASS。

## 不变的方法和限制

固定2048trace/491756B：1542SQL/374acquisition/132transaction，原ordinal映射及新epoch/measure；相同32×64调度，完整双向JSON编码计量和callbacksdrain+parent receipt/close。SQL每组与nonSQL全字段等价；共同parent fork前→close总wall与worker sync/wait/finish/CPU分别记录。不是纯IPC、原pool归因、128容量或稳定收益；4秒ACK/取消最终态/UNKNOWN/KEEP未放宽。

原策略Module/channel/OPS14不改；没有第二监督循环、通用追踪器或新服务。当前经理没有S01 ordinary/replay grant；历史11623661568最低数不代替fresh完整sum，Web发布优先。输入第三方绑定仍区分selected文件/manifest/lock与未逐byte绑定的全部transitive/dylib，actual runtime计划不加载第三方。

下一步只做本delta独审；通过后交root申请3个有意义普通检查并生成实际固定JS。source/meta与trace分账见 `delivery-replay-delta-quality-budget.json`。所有完整S01开放TODO及main边界保持。

## 后到授权（原source-only快照不回写）

2026-10-07T14:52:51Z收到Mika新的15min普通局部段，允许上述caller/emit/TS必要检查及定向修复，最多8child/累计180s/单childwhole40s；新增16MiB总账、raw256KiB、TMP/emit8MiB、meta1MiB，freshfloor至少11640438784B。此许可取代本入口此前“尚无普通授权”的当前状态，但实际60s replay始终NOT_OPEN。结果归唯一delivery-replay-local-segment.json，原失败/输入保持。
