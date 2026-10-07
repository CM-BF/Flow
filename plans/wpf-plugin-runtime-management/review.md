# WPF-PLUGIN-RUNTIME01 独立审查

**状态：UNKNOWN**

当前 target：`6544b66b9b711ba861c67547417c3eb5c5bca074`；scope为[source manifest](../../docs/evidence/wpf-plugin-runtime-management/source-manifest.json)五产品源。base b67530bb025162629895d11482b5505d4a885c91。

[f0ed正式审](../../docs/evidence/wpf-plugin-runtime-management/f0ed-source-review.json)提出PRM-R1；[20ac复审](../../docs/evidence/wpf-plugin-runtime-management/20ac-fix-review.json)确认SOURCE_ADDRESSED/0blocking。6544仅将未导出的runtime公共符号改消费共享实际文件，并明确legacy Pool类型，不改共享barrel或authority。[6544 actual独审](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4/root-prior-local-review.json)已接受源码修正、strict0及失败/清理事实；不接受完整direct PASS。

[有限检查段](../../docs/evidence/wpf-plugin-runtime-management/local-phase/summary.json)：第二strict通过。第三direct JSON为15/15但父FAILED、child exit未知、stdout丢弃，不能认完整direct运行通过。后补exact owned清理独立记录，原始失败/超时账保留。六组HTTP浏览器、生产App、最终授权候选UI、main与部署均未验。

复审请核唯一session authority、UNKNOWN retry409/GET不解冻、同revision GET观察顺序与较高ACK保护、late session、公共ACK及exact安装身份；不把scope内模块fixture等同生产App。历史原件保持固定目标。

## 当前 caller r4（独立准备，尚未审查/执行）

原产品target6544和五scope不变。新调用器只在TMP，state PREPARED_NOT_RUN，见[精确准备提案](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4/preparation-summary.json)；新20s/5cleanup不等运行许可，不把旧JSON通过归为新证据。源审需核pre-spawn raw拒绝、互斥计量、异常独立cleanup、真实exit/双EOF与最终outer合同。完整模块仍UNKNOWN。
