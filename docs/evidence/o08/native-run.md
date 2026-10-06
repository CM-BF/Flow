# O08 一次原生试验：原程序失败，语义结果待独立判定

固定实现7403b56b98070848c189c2d36663cb89846977be，sourceDigest af062a6b456cc964cf6d39f3719a9fb672b94d3b449fbeca32fcb0117b38bbbb，产品base a26；未改源码/产品/配置/组织设置或个人服务。GO先独立APPROVED此准备，再根据用户既有“本机已有Claude/Pi登录状态”及持续低成本原型授权分配本次预算，不是用户另发的新批准消息。[许可记录](native-permit-20261006-071420.json)含诚实来源引用。

approvalId flow-o08-native-20261006-071420，07:14:20–08:14:20 UTC有效，1 SDK query、最多4turns/SDK估算USD0.20/90s；仅纸鸢合成三步图、propose/apply各1、3node2edge、0child。07:15:28.316Z先保存[reservation](attempts/o08-attempt-flow-o08-native-20261006-071420.json)，后保存[query-started](attempts/o08-attempt-flow-o08-native-20261006-071420.json.query-started)，实际入口执行一次。**预算SEALED：失败不改配置补次，不删除或移动marker重跑。**

原程序[stdout](native-20261006-071420.txt) exit1 / failed-or-unknown，原始[result JSON](native-20261006-071420.json)32735B，SHA256 af00249d20bf2715460e33f4596fd0faf7a9cb9b8b31a05fb975f1aa1098ee5a，原样保留。失败阶段collect-and-check-facts；离线只读[分析](native-analysis.json)定位最早不满足的字面断言 `/未执行子任务/`。真实最终正文写“计划已记录，但三个子任务都还没有执行”，并写“没有执行任何子任务，也没有验证任何内容”。不能自动把原程序失败改绿；由GO独立阅读正文和audit判定是否为验收器误拒绝。没有源码修复或模型补次。

分层实际事实：

- requested sonnet/dontAsk/两graph FQ/原SDK配置；init声明实际claude-sonnet-5-5、runtime2.1.290、MCP flow-graph connected/source sdk、两FQ、历史3plugins+3skills精确集合。advertised agents另有声明，不是调用事实，禁止Agent工具；不推断组织hooks无副作用。
- host记录3条allowed（read/command/command），execution仍not-observed。中心持久audit另证propose/apply各1，同runner/task/attempt/fence与同proposalDigest，project从revision1至6。最终图三指定标题、两顺序依赖，每node.taskId=null，中心总task1。
- 中心task succeeded/verification passed、typed final task/attempt/session归属一致；SDK result success/is_error=false，permission_denials reported empty。`received/allowed`本身不证明执行；正文语义与图独立待GO验收。
- **1 SDK query、4turns，SDK估算USD0.031880200000000004**。modelUsage中Sonnet USD0.0305562与原生附带Haiku USD0.001324，均计入此次总额；不是一次底层模型HTTP请求或真实账单硬证明。没有由operator发第二query。
- 从driver startedAt07:15:28.322Z至finishedAt07:15:45.216Z约16.894s。自有PGID95453确认stopped、未强杀，center/随机DB/私有tmp全部清理true，原始output与marker保留。个人61228/4320服务未操作。

[manifest](native-manifest.json)绑定已审source、6产品依赖和6原始/分析文件。无raw thinking或凭据记录。未做Web/UI或child执行验收；未证明插件信任、组织hook隔离、跨进程脱组治理或计费硬上限。原managed准备manifest中NOT_STARTED是当时历史，由当前review补正，不覆盖旧raw。
