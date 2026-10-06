# WPF-ACTIVITYI01 独立审查

**状态：APPROVED**

Review target commit：ba341d77672ba8456197d64d54193aee79719e46

Base：86a36eaeffbf09f0a3772c3d1509c17dc0a76f92

审查者：root / gpt-6-astra / ultra；结论时间：2026-10-06T07:17:38Z。作者仅转录独立结论。批准绑定该实现目标和[status](status.md)的17个实现/受控依赖路径；后续metadata提交不自动扩展批准范围。

## 审查入口与范围

在web-conversation-activity-integration核branch/HEAD/dirty，按[status](status.md)实现范围只读审查固定提交。核完整消息/轮次/任务/连接身份、native当前页刷新与懒body、P01唯一生命周期、官方Thread内部footer及三类贡献、实际native hidden和split行为。检查fixture与真实中心边界；禁止将空模板当通过。

## 独立执行与证据

root完整审查前版15个自有源码/测试文件，并复读R1五文件delta及直接依赖；独立执行7个adapter测试全部通过（2026-10-06 07:16:07 UTC；tests 85ms，总853ms）。17文件hash与target、当前字节及两份新离线browser报告一致；按receipt的literal目录prefix校正后，越界0。初次审查脚本误把目录当glob的文档误报已纠正，不是产品越界。

root在production 51454独立CUA检查当前ba341：公开fixture登录、运行中第二会话的用户锚点、Tool正文与Reasoning展开、浅深主题目检、More actions/Copy task ID入口、草稿分栏保留与分栏活动。console warn/error为空；临时tab已关闭，preview保留。root没有用CUA重测离线；其离线复验依据是独立adapter测试与作者dev/prod实际App专项。

作者完整74局部、typecheck/build、dev11与production10及截图属于旧e930目标；ba341修复执行60相关、typecheck/build和dev/prod实际App离线各1，见[修复记录](../../docs/evidence/wpf-activity-i01/revision.md)。不得称本次重跑全量76或产生一套新的完整视觉文件。root实际视觉抽验属于ba341。

## ACTIVITYI-R1 · P2 · CLOSED

历史结论：e93070cc08339325cd299105f5805ca871a07ea8为REQUEST_CHANGES。root确认adapter未把conversation connection=disconnected纳入read lease；离线后同turns引用展开仍nativeActive=true并读取。generic setOnline未接、native flight也未取消。旧完整检查未覆盖此行为。

作者在ba341修复连接依赖与两个reader有效性，新增2case原实现红、修复后7 adapter绿；60相关/typecheck/build与dev/prod离线专项均通过。root于上述固定target独立复审，R1关闭，没有新blocking finding。成功body:null无效Retry一并修正；原文SHA只作完整原文标识、不宣称内容验证的文档限定已接受。

## 限制与交接

独立批准覆盖fixture下的本片接线与已审依赖；未验证真实中心/provider、模型、产品数据库、Firefox/Safari、屏读或CHAT06组合。generic公共events没有AbortSignal参数，视图失效不能宣称取消所有底层HTTP。root未重复完整browser/build/typecheck；作者原始证据与版本边界保持。

main：已接收 253b8ad38fd869297e7d9948a26c1d310fef5c6c。本人独立核target与c9e交付为祖先、17路径同内容。主线组合7 adapter+44 generic=51与Web types通过由Lead提供，不冒称本owner重跑；原始来源与检查边界见[主线回执](../../docs/evidence/wpf-activity-i01/main-acceptance.json)。本次仅元数据收口，之后全部scope停写，release交manager执行。
