# 固定 auth status 判定链：有界源码结论

记录时间：2026-10-07T11:48:46.101508+00:00。沿原55c4 v1三scope，只读取已固定native 2.1.290公开代码；无native/auth/query启动、无真实HOME/config/Keychain或凭据读取。原产品、recipe及失败原件不变。

本段源码读取从2026-10-07T11:47:23.125636+00:00到11:47:45.990868+00:00结束（首次脚本实际读取52ms累计，墙钟约23秒；已关闭，不继续扫描）。总引用摘录32,622 B，未超32 KiB。原native SHA `b8412a3826b2dc8ecb1c0605970c28dea28355de5faa740407dd881acdd40237` 继承原固定输入，本次核相同dev/ino/size及原三片段hash；未再全量hash/复制233MB二进制。[原始公开片段](status-call-chain-source.json)记录offset/bytes/hash。minified名称在不同bundle模块重复，初次命中中与auth无关的片段明确标为发现过程，不用它们推出认证语义。

## 可判定的具体分岔

1. `authStatus` / `fe`（offset208600911，1672B，SHA `0c61a4b4501002752e481c87cf3754d21627274d70cb1b5483b44e96bfecacc9`）先取 `Dc().hasToken`、`yf().source`、直接API-key布尔值与provider状态。`loggedIn = !gatewayWithoutCredential && (hasToken || apiKeySource !== "none" || directApiKey || thirdParty)`。`Ln()`所得账户元数据不进入此布尔表达式；其email/org等输出不在本任务白名单，也未读取实际值。
2. auth模块的 `Dc`（offset184820784，原[固定片段](../same-runtime-auth-candidate/readonly-inputs.json)，本段Bv窗口也包含完整函数）依次选择minimal/helper、env token、FD token、helper、profile；否则调用 `gn()`，只有 `YB(value?.scopes) && value?.accessToken` 才返回 `claude.ai/hasToken:true`，不满足返回 `none/false`。这不是“文件存在即登录”。
3. auth模块 `gn`（offset184850365，2500B，SHA `60d06ea689fa4978e22cdbf24ed94786757750871c6a84550d8dc7493fb03c64`）有minimal-mode拒绝及进程内缓存；无缓存则调用 `sK`。`sK`（offset184849142，2000B，SHA `7e17de719164ff89d7030e29678f7660ddfec079a25e37b2151a18f074ea20c5`）在env/FD来源及host-managed拒绝分支后，直接执行 `Gn().read({fromStoreCopy:true})?.claudeAiOauth`，有accessToken才返回；读取异常捕获后仍可返回null。本层没有先检查global config的oauthAccount/onboarding。
4. `YB`转 `SDn`（offset181919474，450B，SHA `e1bdcf140120c37d253d4a4da6e6c50f959362eb86ca54fa4ce01a3ab6c6e7d7`），要求scopes是数组且包含代码常量 `nA`。本次不为解析该常量额外扫源码，也不读取实际scope/token。
5. auth模块 `Ln`（offset184869783，900B，SHA `88ac3bf2f0944ab001f59575baf0adf9478e56488bfc042eb6c7d286adbd1dbd`）为 `Fl() ? ce().oauthAccount : undefined`。在已核status函数中用于选定authMethod后的展示元数据，未作为上述storage读取或hasToken的前置要求。`yf`捕获API-key解析异常并返回none，`FE`有env/helper/managed-key等选择；本任务不启用这些替代路线。

## 对当前 false 的解释边界

当前已存公开 `apiProvider:firstParty / authMethod:none / loggedIn:false` 与所有被认可来源均不成立的表达式一致；不能从这一布尔汇总分辨哪一个下层条件导致结果。静态可发生的分岔包括storage未返回对象/无accessToken、read抛错被捕获、scopes不被认可、minimal/host-managed分支或缓存结果。没有持久的下层实际返回值/异常分类，不能选其中之一作为本次根因。

本次找到的是status可直接进入storage的分支，不是实际读取成功证明。`Gn`工厂/存储后端全部内部状态与启动前过程不在本段完整追踪范围；未证明整个程序不存在其它config依赖。已有[source-resolution](source-resolution.json)的default service/account/私有file fallback/default search path结论仍成立，不能由此补造Keychain成功或失败。

**下一步已收敛：现有源码不支持为修复当前false而填造oauthAccount/onboarding或更改HOME；这条假设不作为实施依据。** 如后续继续定位，需要单独授权、可受限暴露的来源解析结果类别（未选择、未找到、读失败、结构/scope未认可），避免凭据内容；当前公开status只汇总，不能提供此区分，本段在此结束，无重复status探针。任何实现/运行需另核具体接缝与授权，不增加认证代理或凭据复制。

完整native观察链仍因大小写覆盖丢失，[fidelity-gap](fidelity-gap.md)不变；不重建原件，不追认R1/R2同因。累计SDK query3、账户费用UNKNOWN、无第四次授权；旧DB/tmp及本次状态scratch KEEP，未读取/清理。
