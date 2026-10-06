# 单目标 Node 加载失败观察候选

Owner chatui01_owner / co-lead mika，WPF-MATURE-02-03；`go-node-loader-cause-once` 当前 **NOT_OPEN**。本页仅设计，尚未写运行逻辑。旧e7结果/e0限定与5b1d3003收口固定，measurement FAIL、全runtime输出UNKNOWN不变。

已有输入见[只读清单](readonly-inputs.json)：归档62个运行路径均在固定profile中；所有已记录绝对依赖有literal。Node的两个归档rpath候选一项未列、一项已列；这不是实际dyld搜索/errno证据。旧261B只保留loader-error-text，已删除原文，无法定位缺失库/访问理由。归档不覆盖全部cached系统传递镜像，不能把静态路径存在当加载成功或因果。

## 唯一目标与宿主取舍

只启动一个自有Node24.20.0目标：原node-rootliteral/candidate.sb逐字不变，`--jitless --no-addons`、同hash immediate-exit、同三条pipe、同自有control/state目录布局与PATH/HOME/CODEX_HOME/TMPDIR/LANG/LC_ALL/TZ白名单值结构；不继承环境，不增加grant。profile仍只绑定本次两个空临时根，不启动canary/listener/SDK/Codex/模型，不编译。

旧R06无累计stdout计数，不再用空queue推0B。候选复用已审 `fd-canary/command.mjs:runOwnedCommand` 的双流capture与bounded close/TERM/KILL/unknown保留；R06生产文件只读。这是一次加载错误观察，**不是旧R06协议执行完全复现**：新宿主不发送initialize，command使用既有detached own group；目标binary/profile/flags/env/script不变，stdio仍三pipe。这两项宿主差异必须写入收据，不能据新结果倒推旧因果。若要求两项也完全相同，先调整设计，不能暗改后运行。

最小拟写范围（均在现v5实验目录内）：新 `node-loader-cause/` 的薄entry、observer/parser与定向tests；共享 `fd-canary/command.mjs` 仅加受限capture上限选项（默认65536保持旧消费者，候选固定每流8192），不复制进程监督器。调用方只容许该一个固定recipe，不开放命令/profile路径或第二slot；不存在恢复/重试入口。

## 观察输出与失败关闭

stderr先写自有0600/wx文件，实际部分写入计副本；仅完整EOF+child close+capture无截断/observer错误+身份匹配后，在内存提取 `errorClass` 有限枚举（library-not-loaded / permission-denied / missing-file / other / UNKNOWN）、明确文本数值errno（无则null/unknown）、最多4个**完全命中固定公开依赖字符串清单**的role。`@rpath/libnode.137.dylib` 等归档公开install-name可单列精确值；任何未知路径、UUID、任意行/栈/环境不出收据，不按basename或substring猜role。原始stdout同样仅私有存放，公开只有bytes/hash/complete。有限匹配只证明观测文字，不代表根因/必要权限。

raw经fsync/close→身份检查→有界分类/hash→finally精确删除；删除前失败或child/group/descriptor未知则保留精确owned identity与unknown，禁止猜删除/杀他人进程。两流累计实际观测/复制分别计量；额外输出、截断、超界、未关闭或计量未知立即停止，不能将短输出或CLI0当Node隔离/资格通过。

## 额度、验收与下一步

唯一许可候选：0compile、≤1target、30s入口fingerprint到自动证据/cleanup/result/CLI，外层固定time+UTC覆盖host加载/退出；人工review/Git时间外，实际bytes仍计总256KiB。拟预留prepared≤96KiB、两流capture+disk≤32KiB（各流8192B，复制双计）、owned配置副本≤8KiB、机器收据/CLI≤16KiB、人工归档≤64KiB、outer捕获+副本≤4KiB，共≤220KiB，余36KiB；固定包时按实际清单核，不把未知输出算零。任一上限不满足则不启动。

源码获准后仅做0child/0listener纯检查：精确role匹配/拒绝用户及未知路径、errno缺失/矛盾、截断/多字节、部分写失败、finally清理/身份不符、共享command默认cap不变与低cap停止、wx单次预约、原生惰性import。固定组合+输入/外部hash+精确输出不存在+fresh claim/clean HEAD交另一位≥Sol独审，再由Mika开启唯一窗口。现在不写执行逻辑、不测新目标、不申请扩大grant；ENG native权限/≥Sol模型/全部writer停止仍未证明。

方法：本地find-skills匹配brainstorming（有界候选）、codebase-design（复用唯一生命周期）与clean-code；sickn33固定bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不安装。2026-10-06 13:10:49 UTC复核职责/错误分类/unknown/资源与字节所有权；无工程检查。本新阶段不追改旧Node128KiB历史archive快照。
