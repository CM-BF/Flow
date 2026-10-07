# D05 Review

**APPROVED — 仅下述固定实现与明确检查范围。**

Target：`cad1251fdbe8f8b527a78c60cf45adce68e4f534`。Base：`3773db5d014a6d38d09553acd0a5fe8df900b7c4`。Reviewer：Goal Owner / gpt-6-astra，只读独立审查。Scope：架构数据、图交互、固定静态资源与维护规则，不覆盖产品实现或未来规划功能。

验收：五视图与固定main事实对应、前端/中心/runner/外部包边界明确、实际FSM与独立verification、PG连接和工程账本分离、100%可读/图内滚动、双主题/窄屏、固定源码链接、阅读状态不被进度刷新重置。关键文件为public/architecture-{data.js,css}、architecture.js、index.html、src/server.mjs、test/architecture.test.mjs。

## 已执行与未执行

Reviewer逐行查看源码及test传输修复，实际CUA查看运行/模块/数据/FSM/依赖视图、绕侧连线、短标签、固定源码链接与默认100%可读性。读取作者保存的最终Node2/2 fail0与初始1pass1fail；没有重跑工程测试。作者检查见[final输出](../../docs/evidence/d05/local-checks-final.txt)、[浏览器记录](../../docs/evidence/d05/browser-checks.json)、[质量与失败保留](../../docs/evidence/d05/quality.md)。0模型；无全工程测试。

| Severity | Finding | Blocking | 作者回应 / 复审 |
| --- | --- | --- | --- |
| P2 | 初稿检查证据1pass1fail却曾汇报2/2 | 已关闭 | cad1251将Host负例改node:http显式请求；产品server未改，403/405/CSP/404仍断言；保留initial失败，final2/2。Root逐行复审批准 |
| P3 | 模块图部分import共线路径追随性一般 | 否 | 后续有实际结构更新时再优化，不阻本次交付 |

结论：Root明确APPROVED固定cad1251，可集成并部署4320。图是固定3773基线说明，不是实时拓扑；O01/WPF-I01/X01开发或计划标识不能作为能力验收。部署后的live服务事实另记status，不将本审查冒充已部署。

## 可复制复审任务

先读本plan/status，核实际branch/base/head/dirty，对具体新commit只读审查差异及其源码依据；检查证据区分自己执行与作者保存，默认不改实现。直接修复需Sol以上、独立worktree和有效claim。记录severity/blocking、限制与复审target，不把本approval泛化到后续实现。

## 两来源登记独审 2026-10-07

APPROVED_DOCS_REGISTRATION_ONLY — native_center_owner / gpt-6-astra，target0b27528ac50729b96e595bf375ecd0dbc73a071a相对5152f32a，共3文件。两source/branch/evidence与6份固定三件套bytes/hash一致；188候选和186旧实际明确分开，历史UNKNOWN保留；P1/P2=0、reviewer工程运行/写入=0。主线接收9816e87a，实际载入回执另列，不扩大原产品approval。
