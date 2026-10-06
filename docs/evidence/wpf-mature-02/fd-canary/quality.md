# 静态方法与限制

本段使用find-skills本地优先方法：现有本地clean-code/codebase-design与brainstorming适用于C小接口/资源设计，未发现必要新增C专用技能；沿用固定sickn33 clean-code bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不安装。2026-10-06 10:43:49 UTC安全点及后继小修核查命名、立即保存errno、无未初始化stat读取、固定单次写/短写错误、独占报告、fd<3拒绝、close与字节上限。architecture_read只读草稿两项建议已纳入：报告不得占用被测stdio、失败结果与零errno矛盾拒绝。

本片没有C编译、SBPL编译或行为测试。static-checks只说明JSON解码与源码/固定profile前缀比对，不推断实际syscall、工具链后代关闭、计量或隔离成功。后继薄host需固定可执行组合并覆盖所有owned资源失败路径；当前没有执行入口。
