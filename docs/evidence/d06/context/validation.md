# D06 本轮验证

固定实现 `ebad46356efec7bd86f8aadd9d765bb6b6b190af` / base115b。运行报告保留当时 `b3ec1c4bf7dbdc927d393a26bc94d82265ee4730 + dirty`，不事后改sourceCommit；[5源SHA256绑定](source-binding.json)已逐个核作者browser记录、target和当前字节完全一致。

- [direct.log](direct.log)：10/10 Node PASS，1572.255917ms；source存在/图尺寸与边、HTTP静态读策略、已集成与后继、Queue CAS、受限图、任务FSM、PG正文来源、K01/K02、模块尚未安装/挂载。
- [source-audit.json](source-audit.json)：47个独立节点来源与49条人工策展依据，全部固定115b。020/022 migrations缺失，现contract liveAssistantText/steer=false；不以缺一个猜测文件路径作为唯一证据。
- [browser-checks.json](browser-checks.json)：2026-10-06T06:33:07.051Z，Chrome 154.0.8037.98，五视图9/23/13/12/7节点、Enter/Space选择、sourcehref固定、23节点不溢出；新增7节点详情边界检查；浅深主题/390px/减少动画/缩放；pageErrors=[]、passed=true。请求只达本预览api/snapshot，registry为空，不读真实source/协调DB。
- 实现 diffcheck0；renderer/CSS/App/server/packages/根manifest-lock保护路径零diff。没有build，因为只改变原生ESM静态数据及Node专测，不涉及打包产物。

## 失败与修正

[first-direct.log](first-direct.log)原样保留：9/10，新增source断言误写 `row.conversation_id`，固定源码实际 `input.conversation_id`；按实际成员名修正，仍验证conversation身份拒绝。后续10/10。初个browser全通过，最后一条非运行事实文字更正后重新执行最终browser并绑定5hash；没有清洗raw日志或删除断言。

作者截图实际目视可读；独立review尚待root，不冒称独立运行。无模型/真实中心/产品DB测试，不改已部署服务或4320。主线固定源码与个人fb906服务不混作一套运行证据。
