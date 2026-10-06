# 本轮验证边界

源码目标 `5124e6cea1edd3437f765ff67aa13386ae845bfa`，策展固定 main `0da869f7bad98771177472539b5a192365c15117`，分支base `6d05ec467581e85d21d5532fd29a2bebd1411b41`。数据与直接测试已冻结。

- [静态来源核对](source-proof.json)：116个固定Git源、157条可识别的字面来源regex核对，错误0；83节点，34处节点文本/来源字段更新，ID/坐标/kind及非node骨架不变。这是Python读取/文本核对，不是JavaScript语法或测试执行。
- 原182个D06证据文件保真。旧aeb 18个Node用例与旧五图页面结果仅覆盖旧target。新22个direct用例全部NOT_RUN，不能由静态名称数量称为22 PASS。
- 将来直接入口仍为 `apps/execution-dashboard/test/architecture.test.mjs`。顶层server→aggregate→ledger会解析pg依赖，其中一个用例开随机loopback静态HTTP；不是无第三方/无HTTP纯检查。实际准入必须绑定本树入口和只读依赖，不能借旧free/gate。
- 新数据的SVG单行文字布局尚未实测。原225×80卡片、renderer/CSS/server未改；不由几何未变推定新文案无溢出。必要新页面验证沿原五图、键盘、390及双主题接口准备，独立审查/准入后才执行。
- `snapshot-aeb/source-audit.mjs`、`browser-check.mjs`、`preview.mjs`均原样保留历史：其中旧baseline、正负挂载regex、checker/history旧断言和输出目录不能用于新target。后继如需执行，须在新own证据目录重绑；本批不增加运行包装、不覆盖旧raw。

本轮无Node产品import、noEmit、测试、页面、PG/Chrome/provider、free/proc扫描。新source审查不等实际运行、个人部署或main接收。
