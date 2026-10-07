# MSG03 固定源码独审入口

当前实现 **6a258a3886f0491b8487738c19c09dc631b98f2c**；base `c13042ba7e74733d8c68cc05bd1b2d7cb5bbaa50`。WT `web-message-settings-app` / `codex/web-message-settings-app`；claim7e3f v2 exact19（14产品+3test+2metadata）。原MATURE02 TODO11子片，不是新大task。

固定9c46的 [root集中审](source-research/root-msg03-9c46-mounted-source-local-review-20261007.json) **APPROVED_SCOPED_SOURCE_AND_LOCAL_PREPARATION**，0findings；随后c4bee只修worker参数白名单，独立假sentinel通过、caller边界已获root475e限定准备批准。完整feature **IN_PROGRESS / material-return 三次FAIL / message-settings-app NOT_RUN / 6a修复未复验 / NOT_INTEGRATED**。[17源码manifest](source-manifest.json)、[浏览器准备](browser-preparation.md) 和 [独立阶段记录](browser-phase.json) 固定当前范围。最终metadata HEAD不反套过去执行头。

App每view唯一C与opaque ownership；P01现action/context私有port复用Picker同步CAS。发送前冻结A并同步换新稿ownership，官方text通知不抹C；原key/body的Send与Queue收据、历史turn和Queueitem各自显示frozen requested。Recovery完整draft含可选设置、兼容旧缺省、非法值拒绝，沿原revision/CAS和namespace/lifetime。材料await期间同正文/settings-only B独立，旧opening不写新B。

官方core失败/取消自动return由公开ComposerRuntime订阅/getState/setText/remove隔离：保heldA与当前B，不改core、不新增editable store/FSM。显式Restore使用本次点击时的完整目的地lease，不永久绑send旧generation；B非空拒绝，用户清空/omit后可完整恢复A。每await复查。**本次新产品修复**是在完整A恢复成功后才discardFailedSubmission，释放旧failed hold且不删当前draft文件，使不同IDs下一准备合法；冲突/部分恢复不清A。真实取消入口只在binding preparing且官方submission存在时显示，点击时再次双guard再公开cancel；默认consumer无入口变化。

## 实际局部与证据归因

旧[25原件](local-20261007/manifest.json)/[9fc批准](source-research/root-msg03-9fc0-source-local-review-20261007.json)保留：direct6十一PASS/57未选，真实installed core与生产guard/helper受控检查；不外推完整mountedThread。37166两P2历史审查与所有首红原件不改。

本次[13新增原件](mounted-local-20261007/manifest.json)、[摘要](mounted-local-summary.json)、[终态](mounted-local-20261007/terminal.json)记录probe1/2与types6/7/8。最后probe2对**实际fixture String.raw**提取代码进行6项VM行为检查：失败、取消忽略abort后迟到settle、成功、3hold/8identity界限、dispose及timer；不代浏览器。types8明确files传递noEmit exit0，全部17源码hash=9c46；后继只有browser参数白名单、fixture公开header透传和browser chooser错误观察变化，各限定审查分列；独立假sentinel验证只归c4bee，非wholeWeb。此段实际累计 **53579/60000ms，余6421ms**；0network/PG/Chrome/provider，regular-file logs，不称双EOF。五个新PID/PGID fresh ESRCH、scratch absent；旧9fc局部历史保持。

原floor提升前probe1/types6真实free已高于两线，未追改原记录；types7/probe2/types8用新6914834432线。local余量不作browser信用。当前没有活动检查。

## 两条 mounted 候选与真实边界

`message-settings-material-return` = cookieRead + messageSettingsMaterialReturn。实际File upload→原adapter.add ready→原adapter.send验证后有界fixture-only await，官方core仍等材料而未onNew；并非HTTP ACK hold。failure/settings-only B、cancel/同正文B+真实文件，取消后旧promise实际settle，前后B完整持久data与真实id/name/ref一致、无旧A命令；显式清空/omit B后完整A准确恢复一次。恢复区消失、真实remove不DELETE中心资源、下一不同材料能继续准备；成功A期间B保留。最后同document切view使旧opening失效。

`message-settings-app` = cookieRead + messageSettingsApp。保首mount P01、Apply/Cancel合法回焦点、reload/re-auth/显式nativeIDB restore零auto业务POST、原key/request A丢ACK重试、Queue B相对liveC、历史requested与真实theme390/180字符同前缀目录/每PNG≤512KiB。

两个selector各独立markedDB/Chrome/public syntheticpublisher，**共享唯一90000ms**新phase，每attempt≤60000含30000cleanup、remaining<45000停。源内parent只准这两selector；旧Recovery选择保留参考却不可在新入口运行。每次保守ceil(max outer/late/serialized)扣账；不重置/不借Recovery/local。probe只fixture启动可达，≤3hold、每hold10s、≤8身份，每项≤1024chars，dispose/pagehide清timer/listener。B观测只读，不能造IDB或业务响应。

配置连接保守14（8center+3boss+1fixture+1admin+1cleanupmarker），非实测峰值；一DB/Chrome，64MiB scratch，9MiB retained、启动<4/run reserve5，1GiBreserve只计一份；最新已报组合floor至少7515275264且实际更高值优先。真实启动仍需要经理共享资源交接/freshinputs/env/uniquegate。当前没有gate/adminenv/PG/Chrome预约。

## 未完成交付与质量

源码和局部通过不等两条页面、视觉或主线；原runtime/native包已审并实际运行；固定SQL供给缺项已补，材料旅程仍FAIL，当前修复未复验。真实个人目录另依赖受信opt-in profile/runner发布turnSettings→Web/TUI目录→个人配置发布（原TODO08/11共享owner）；fixture synthetic目录不冒个人可用或provider有效。

[clean-code](quality.md)：soleauthority、默认兼容、真实故障/重试、错误和cleanup分离。root撤回“exact File attachment未排uploading”的先前猜测（官方label已排除），不记为bug；本次仅有意义加强B完整身份和已有Send前置，无扩新场景/超时。

本批运行边界更正：worker不再继承Node execArgv中的父admin --env-file，固定tsx loader白名单；c4bee单行域差量由独立假sentinel新10s段实测old-negative/new-positive，exit0、charge219ms、双EOF及owned清理。原60s局部53579/6421未用封存不转credit。9c46 root8488批准保固定source/local范围；本新参数差量与具体outer capture已获root475e限定准备批准；首次初始化FAIL见实际记录。

## 2026-10-07 首次实际安全点

当前实现仍c4bee，执行头df185。首material-return在server初始化因固定c130 SQL017未物化失败，0组完成/无Chrome；实际exit1、双EOF、markedDB正常DROP和owned资源清理闭合，首红不重写。其后按原source-operator补017/019共3278B，全33SQL等fixedbase；这是依赖供给修复。根475e准备批准保留，不作实际PASS。当前90s phase spent3432/remaining86568，后继实际仍须fresh唯一资源与新输入；无当前holder。入口：[首轮原件](browser-attempts/material-first/manifest.json)，[SQL供给](runtime-sql-supply.json)。

## 历史424c差量与第二actual

该轮target 424c6466bd28a838b91cc490a7b52021202b4d17 仅fixture公开目录header一行透传；16其余源码不变，c4bee/root475e原批准与两FAIL均保持历史绑定。第二actual cookieRead PASS、material选择FAIL未进入hold，无PNG；当前phase18962/71038，清理闭合。源码链与实际限制见 fixture-protocol-fix.json；不改原count/timeout或把准备当通过。

424c一行差量已获root dfe8限定源码批准/0finding，原件保存在own source-research；并非related actual已通过。

## 当前chooser错误观察差量与第三红

当前target 6a258a3886f0491b8487738c19c09dc631b98f2c 只browser4+/2-：真实Add Attachment enabled前置+同时await选择事件/click。第三actual worker因选择事件unhandled rejection提前exit1，缺browser/fixture结果；不把partial log当组通过。原父DB/groups/EOF/scratch/env清理有证，fixture优雅关闭UNKNOWN；phase33766/余56234，actual HOLD；本差量已审，下一资源交接未提供。旧各source批准/FAIL原件保原归因。

[6a258 root审](source-research/root-msg03-6a258-chooser-error-review-20261007.json)已接受此错误观察差量；三次actual仅绑定各自executionHead。当前17源码manifest绑定6a；phase33766/56234，NO_NEXT。fixture graceful close UNKNOWN、材料恢复/第二消息设置旅程及双主题截图尚未通过；物理DB/process/scratch/env收尾与此区分。
