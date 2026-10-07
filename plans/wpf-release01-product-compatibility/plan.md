# WPF-RELEASE01 真实产品 Web 发布兼容验证

状态：in-progress（原REQ19后继）；原7805交付保持历史完成。直接父WPF-MATURE-01与co-lead沿唯一status。新后继复用原四scope，不创建第二发布系统。

## 当前固定origin后继

复用原两harness及公共发布接口，三份immutable App→同一最终backend/context。实际App保持Bearer，独立Cookie/CSRF为补充来源；format1 artifact可用format2 compatibility report但不补releaseId。固定origin61228仅从受控Chrome真实页面访问，精确ownedproxy转自有动态center；Node/PW APIRequestContext不能访问61228。禁止rebuild/install/个人连接/旧tuplefallback。设计及精确输入见[报告](../../docs/evidence/wpf-release01/fixed-origin/report.md)，已审网络补充见[design-review](../../docs/evidence/wpf-release01/fixed-origin/design-review.json)。

- [x] RELEASE01-01 历史固定双版本构建与隔离center/runner。
- [x] RELEASE01-02 历史两App四类兼容证据。
- [x] RELEASE01-03 历史独审/main接收。
- [x] RELEASE01-04 实现显式最终输入、严格代理、真实浏览器请求、流式SSE/ACK故障和有界清理。
- [ ] RELEASE01-05 完成必要源码/局部检查；最终tuple及合法资源段到达后真实三App四项compat与独立Cookie补证。
- [ ] RELEASE01-06 后继独审与主线接收，原operator另执行个人发布。

模块职责：fixture唯一拥有输入校验、owned DB/center/proxy/静态bytes/公共runner；browser只真实UI旅程和独立page内session探针；既有web-release工具拥有最终报告codec/import/verify。缺供给与unknown清理显式失败，不维护第二权威。不导入未来未知runtime，也不借旧dist。

验证按局部影响：先固定源码与精确依赖/定向types或pure检查提案，实际运行另有界段；不全库、不继承旧结果。发布报告只有四raw真值、真实source/context/asset绑定与成功清理后可接收。

## 历史已交付计划（原件保留）

见[7805计划原件](../../docs/evidence/wpf-release01/fixed-origin/previous-plan.md)。其中build方法不再作为后继入口。

历史首段2026-10-07：f3d限定源审0blocking；唯一strict检查发现adapterVersion声明过宽，9658仅type-only公共接口修正，NOT_RETESTED。首失败/1170ms/完整清理保留；暂停本四scope写入并保claim，管理顺序先DPERF收口，后独立10s必要复验。

当前：9658源码delta已独立接受，必要strict复验exit0/904ms；原首红不改。RELEASE01-05仍待最终tuple、caller与三App真实兼容，不把类型检查当四check通过。四scope停写，38b9v1保留，无运行预约。
