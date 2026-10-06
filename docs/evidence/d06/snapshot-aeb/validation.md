# 本批验证与限制

固定实现 `6570ef7e896d29040961247f46aa62dc4e466284`；feature base `631173ab1c1ffa3ae7d4636f0ea8c941e2c1943f`；图来源 aeb764e5d2c2ec043ae8673cde2724f5330db2ab。五source及七只读文件见[candidate](candidate.json)，现文件/target/browser报告哈希全同。

- Node24.20.0 `node --test apps/execution-dashboard/test/architecture.test.mjs`：[最终18/18、0skip](node-final.log)，2279.195ms。首轮[15通过/3失败](node-first.log)完整保留，分别为新测试误写ContextHistory挂载函数名、Web发布函数所在模块、工程协议字符串定义位置；固定源码复核后修正为实际对应入口，未修改产品合同或跳过检查。
- `node docs/evidence/d06/snapshot-aeb/source-audit.mjs`：[106文件SHA256/171关键行](source-audit.json)，全部来自git show固定aeb，包含节点源及策展依据；不等运行这些领域测试。
- `node docs/evidence/d06/snapshot-aeb/browser-check.mjs`：[实际静态renderer/空snapshot fixture](browser-checks.json)，五view、固定source链接、Enter/Space、zoom、desktop浅深与390/reduced-motion；9034.423ms含cleanup，browser/独立动态端口server均fulfilled。单轮90秒预算含≥10秒预留、当前raw约1.52MB<8MiB，无第三方服务/真实registry/ledger/PG/model。
- 实际目视modules-bottom-light、data-dark及data-dark-narrow：节点/分组清晰，新增工程职责及026/027不增加图高；390沿原42%最小zoom局部滚动，无page横溢。不是全部内容同时无滚动、也不宣称产品App窄屏验收。
- 保护范围renderer/CSS/server/deps对feature base零差，生产两文件与脚本diffcheck0。原runtime批证据未改。

脚本执行时HEAD95d8664、五执行文件尚未提交；冻结6570后的逐hash绑定证明同源，不冒称浏览器是在冻结commit之后重跑。独审APPROVED（独立18项/source审计，未重跑browser），main未集成，4320/个人服务未采。既有服务版本只引用[SVC05正式receipt](service-owner-observation.json)，不把fixedaeb source当部署。

独立预览可用Node24运行本目录preview.mjs，它只提供空管理snapshot和真实static assets；结束需SIGTERM关闭自有server。本次浏览器自管preview已清理，没有新增常驻服务。
