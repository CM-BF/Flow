# 当前浏览器源码审查与首次实际

状态：APPROVED（仅固定源码准备；b1 actual FAILED，完整功能/visual未通过）

Review target commit：0bc393de593fd9d057efa08cd6d4ff261f99b24f

Scope：原五产品 literal；其中 PluginManagement.tsx/runtime-command.ts/direct test 逐字等于旧6544，只有 browser.ts 与 fixture/main.tsx 两源准备改变。精确[五源与caller pins](../../docs/evidence/wpf-plugin-runtime-management/browser-preparation/source-manifest.json)、[两生命周期diff](../../docs/evidence/wpf-plugin-runtime-management/browser-preparation/README.md)已由root固定独审，0 finding。

旧strict与r4 direct15 actual限定批准保留，不迁移成两新fixture/六browser通过。[source独审](../../docs/evidence/wpf-plugin-runtime-management/browser-review/source-review.json)与[native边界接受](../../docs/evidence/wpf-plugin-runtime-management/browser-review/native-boundary.json)已归档；随后manager确认个人窗口实际归还，已执行一次b1；source已审范围：私有真实JS/CSS映射、decoded read后UNKNOWN、真实组件/controller生命周期不变、native外层隔离差异、scratch identity KEEP、OPS unknown保真与actual外层退出联合终态。

## 当前首次 browser actual（待独立证据审）

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
