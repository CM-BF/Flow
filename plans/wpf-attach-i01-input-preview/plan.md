# WPF-ATTACHI01 附件输入与恢复模块

状态：in-progress。创建/更新：2026-10-06 11:03:55 UTC。直接父任务：[WPF-MATURE-03](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-03-attachments/plan.md)。沿[统一模块规则](../../AGENTS.md#modular-design)。

采用已批准设计：用已审8701附件DTO、宿主绑定typed ports与现assistant-ui0.15.23/core0.3.22，提供文件选择/拖入/@file、metadata和按需正文预览、固定引用捕获、有限upload恢复日志。实际官方Thread隔离fixture验证，不改App、公共client/decoder、共享合同、依赖、既有Send/Queue或官方Thread。六公共HTTP方法/生产App接线后继明确pending，不把独立模块当完整附件Done。

## Interface 与预算

[接口](../../docs/evidence/wpf-attach-i01/interface.md)定义connection/view/project绑定、read/write readiness、原字节上传与未知回执、generation隔离。只接受.txt/text/plain 1..8192 UTF-8原bytes；复用合同decode/hash/schema，knowledge先于attachments，各自保序，合计4引用/8192 bytes。选择metadata，正文显式展开。上传1、列表1、正文2并发，单次15秒local deadline；20条目录/4份正文缓存；恢复元信息16条/64KiB，不存File/text/token。unknown不静默淘汰。修改草稿不删除中心in-use资源。

## TODO

- [x] ATTACHI01-01 实现绑定ports、官方attachment adapter及固定引用捕获，局部语义测试。
- [x] ATTACHI01-02 实现有界原key上传恢复与官方Thread可用输入/预览，双主题390/键盘验证。
- [ ] ATTACHI01-03 clean-code、固定source证据、独立review与主线交付。

无真实模型/产品DB；本片模拟ports不是真实HTTP或center重启证明。浏览器reload恢复只覆盖upload记录；Send/Queue unknown跨reload恢复仍未实现。公开exports未桥接时仅直接导入本树已审合同文件，不创建伪client方法；最终公共client接线另审。
