# WPF-K02C01 独立审查

**状态：NOT_STARTED**

Review target commit：UNKNOWN

Base：3d4985fca060155435b159e0467815bf8e88b8b8；共享输入例外：e9a0259151fcb215e1bd607b5461d81412da2742（原样 Lead 三 contracts patch）。Web scope 为 [status](status.md) 六文件，审查包含整个本片实现，不以共享接口审批代替Web审批。

可复制审查任务：先核worktree/branch/head/dirty与claim，固定target只读审核projectId presence/value、GET与CREATE回执一致、unknown原key、旧cap缺省兼容、context元数据不变正文、零详情预读；核直接行为检查和O07 allowlist。禁止写实现/shared，finding按severity/触发/行号回唯一owner。独立运行明确记录范围，未运行不得称通过。

作者检查：尚未执行。独立检查：NOT_STARTED。Blocking findings：尚未审查，不代表无缺陷。修复/复审：无。main：未集成。本片不包含K02领域后端、引用选择/发送或真实中心模型验收。
