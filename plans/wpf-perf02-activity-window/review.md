# WPF-PERF02 独立审查

状态：APPROVED

Review target commit: a87f64f48a3b7e8d03429ab0673c210076a2df0d

Base: cc33403cd9b357fcd85484b7bc6952dc1220d689

报告/原始证据：`d891195688d849e7623cd2805b3f64cfd07b959d`；标准分支字段metadata：`a7dc3236e26177ea7a67a43817cb37b0c52c92c7`。六个实现/测试文件对target差异0。本文件后续metadata不自动成为新实现approved target。

Reviewer：root协调者 / GPT-6，只读审查；正式结论转录于 2026-10-06 03:48 UTC。Scope：三个Activity生产文件、window算法/browser测试与唯一performance probe；无公共协议、App/Thread/host/I01/CHAT实施。

## 实际独立检查

- 独立执行13局部/直接projection tests（2files）PASS；fixed diffcheck0。
- 阅读ActivityWindow/Overview/CSS、三个测试与probe全diff；核实际行高、稳定ID锚点、独立focus保留、ResizeObserver清理和历史访问。
- 阅读作者8组普通production browser脚本/原始报告；实际目视390浅深截图。
- 重新独立生成三场10040条expected id/cursor/256字正文SHA，与浏览器遍历actual一致（不只是比较JSON内两字段）。复核raw SHA256、统计、96trustedkeys/32trustedwheels、detail1/cancel0/pageError0及请求数解释。
- 核末DOM200/802/1077、最大16挂载、vendor三个资产不变、实现/共享/rootmanifest/rootlock范围。

未独立重跑：typecheck、production build、8browser与正式性能矩阵；使用已检查的作者固定原始证据，避免同机重测干扰。未验证screen reader、Safari、Firefox、真实center、I01/CHAT未来组合；交MainLead执行局部集成检查。

## Findings / 结论

No P0–P3 actionable findings；blocking 0。**APPROVED**，只覆盖固定target的Activity窗口/已测交互/测量报告；不是main集成或完整Flow性能验收。

保留限制：共享机器每规模单样本；LongTask阈值下0样本不等于零延迟；自采rAF不等于INP/paint；CDP heap无forcedGC不代表retained/无泄漏；projection/height/prefix仍线性缓存，未声称百万历史支持。完整性遍历单独phase，之后继续poll的全程HTTP数不与原时长直接比。详见[结果](../../docs/evidence/wpf-perf02/results.md)。

作者回应：接受范围和限制；本轮没有独立review修复commit，开发阶段失败已如实保留。最终metadata后停止本scope主动写入，保留claim供受控review修复/交接，不自行merge main。

后续review任务：若target后实现变化，先核新SHA/branch/dirty/当前claim，重审具体diff和影响面，不复用本结论。主线集成另由Lead记录。

[Plan](plan.md) · [Status](status.md) · [质量记录](../../docs/evidence/wpf-perf02/quality.md)
