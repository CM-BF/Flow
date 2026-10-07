# SVC05R01 — 保留页面与新后台兼容

创建 / 最近更新：2026-10-06 18:55 UTC；状态 in-progress。所属大task：[FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)，REQ19发布后继；co-lead Execution Lead。

在一个独立marked数据库和真实af51工厂上，顺序验证两份现有保留网页的公开读取、发送、显式原key恢复和能力协商，补齐受管发布所需的准确组合报告。页面始终从固定产物读取，不构建新页面；不读取或变更个人安装。

复用[模块规则](../../AGENTS.md#modular-design)。四模块分工见[Interface](../../docs/evidence/svc05-retained-web-compatibility/interface.md)。旧SVC05迁移、checkout、安装、candidate构建和无关读口验收删除；这不是重新执行dc8或已批准d629 A/B。

- [x] SVC05R01-01：独立source-only树、fresh原子claim和固定输入。
- [x] SVC05R01-02：完成仅两保留网页的隔离脚本及静态闭包，独立源码审查。
- [x] SVC05R01-03：获唯一资源窗口后真实App顺序验收和可核清理；失败/未知原样保存。
- [x] SVC05R01-04：独立核验固定报告及界限，交受管发布owner接收。

当前仅源码准备许可。0PG/browser/provider/build/install/个人服务。运行工作/输出/空间门槛是候选，不自动授权；Lead独立审查后另给一次窗口。一个Chrome/两个context依次退出，一个center/fixture runner/随机DB；checkpoint成功、同marker/目录identity且连接归零后普通DROP/删除自有tmp。未知保留，无强杀用户资源。

源码固定与静态闭包及独立准备审查已完成；SVC05R01-03/04仍未运行/未验收，不将准备批准冒作兼容通过。

2026-10-06 19:54 UTC：本次2App真实隔离兼容与自有资源清理通过，结果等待唯一独审；原两失败、9pure范围不改，不自动授权个人发布。

2026-10-06 20:01 UTC：04独立结果批准已归档；两准确tuple报告交发布owner，main集成由Lead处理。此前NOT_RUN/FAIL为历史，不覆盖原证据；个人导入/发布未执行。

2026-10-06 20:06 UTC：独审后的两scope与4产品源已main1126精确接收；本片已交付，个人发布仍属SVC05H后续，不扩大为上线。
