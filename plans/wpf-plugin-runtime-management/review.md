# 当前焦点窄修复审查入口

状态：NOT_STARTED（当前a952窄修复；未复验）

Review target commit：a952ae81fefd3a82c9dfe42067048bcf2702d1c3

Scope：原五产品literal；实际只组件与browser两源8+/3-，其余三源未变。[固定manifest与接口边界](../../docs/evidence/wpf-plugin-runtime-management/browser-focus-fix/README.md)。pending期间以aria-disabled+guard替原生disabled，避免自动失焦且不重复读；真实decoded read+settlement后保原toBeFocused，不末尾focus/延长timeout/删除断言。

旧0bc的[source/native限定接受](../../docs/evidence/wpf-plugin-runtime-management/browser-review/README.md)和本次[失败/完整return接受](../../docs/evidence/wpf-plugin-runtime-management/browser-b1-actual/root-failure-review.json)各保固定目标，不迁移为a952实际通过。后继b2只最小priorcarry，worker未改，parent待同boundary精确绑定。

## 历史：首次 browser actual（失败/归还已独审）

[b1原件](../../docs/evidence/wpf-plugin-runtime-management/browser-b1-actual/README.md)：outer1/terminalFAILED、0reported groups/0PNG，真实完整cleanup；charge12,385ms/剩47,615ms。第六组refresh自然focus失败，原三份产品/两fixture与6断言均未改。先前source批准不等运行通过，不用补签或末尾手动focus掩盖；候选同scope修复待manager。

## 历史已审模块与direct（原文保留）

# WPF-PLUGIN-RUNTIME01 独立审查

**状态：UNKNOWN**

当前 target：`6544b66b9b711ba861c67547417c3eb5c5bca074`；scope为[source manifest](../../docs/evidence/wpf-plugin-runtime-management/source-manifest.json)五产品源。base b67530bb025162629895d11482b5505d4a885c91。

[f0ed正式审](../../docs/evidence/wpf-plugin-runtime-management/f0ed-source-review.json)提出PRM-R1；[20ac复审](../../docs/evidence/wpf-plugin-runtime-management/20ac-fix-review.json)确认SOURCE_ADDRESSED/0blocking。6544仅将未导出的runtime公共符号改消费共享实际文件，并明确legacy Pool类型，不改共享barrel或authority。[6544 actual独审](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4/root-prior-local-review.json)已接受源码修正、strict0及失败/清理事实；不接受完整direct PASS。

历史[30秒检查段](../../docs/evidence/wpf-plugin-runtime-management/local-phase/summary.json)：第二strict通过。第三direct JSON为15/15但父FAILED、child exit未知、stdout丢弃，不能认完整direct运行通过。后补exact owned清理独立记录，原始失败/超时账保留。六组HTTP浏览器、生产App、最终授权候选UI、main与部署均未验。

复审请核唯一session authority、UNKNOWN retry409/GET不解冻、同revision GET观察顺序与较高ACK保护、late session、公共ACK及exact安装身份；不把scope内模块fixture等同生产App。历史原件保持固定目标。

## 历史：caller r4 source-only 准备

原产品target6544和五scope不变。新调用器只在TMP，state PREPARED_NOT_RUN，见[精确准备提案](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4/preparation-summary.json)；新20s/5cleanup不等运行许可，不把旧JSON通过归为新证据。源审需核pre-spawn raw拒绝、互斥计量、异常独立cleanup、真实exit/双EOF与最终outer合同。完整模块仍UNKNOWN。

## 历史：r4 源审与实际结果

[r4源审](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4-actual/root-source-review.json)0blocking；[新actual](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4-actual/README.md)parent/child0、15/15、内外双EOF/0drop、exact cleanup、882ms。旧direct JSON部分证据不替换，此次是新的独立有限段。[root实际独审](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4-actual/root-actual-review.json)已APPROVED_DIRECT15_ACTUAL_AND_COMPLETE_RETURN/0finding；整体UNKNOWN因browser/生产App仍未验，不冒完整模块审批。
