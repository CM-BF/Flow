# P01 方法与质量记录

## 技能发现 / 来源

2026-10-06 02:02–02:17 UTC，Node24/TypeScript、A2A/MCP HTTP接入，owner assignment_review / gpt-6-astra。独立worktree协议范围，不启动模型或云任务。

- 实际读取 `/Users/citrine/.agents/skills/find-skills/SKILL.md`（SHA256 c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f），优先已有本地skill。`codebase-design`、`tdd`、`brainstorming`、`clean-code`实际读取并应用，不重装。
- codebase-design本地SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`：FlowProtocolPort隐藏中心实现；SDK处理wire，Flow映射、HTTP挂载分模块，不造双协议总框架。
- brainstorming：新协议子系统按Architectural评估，记录SDK与手写候选后选择官方SDK，设计在[架构记录](../../architecture/p01-protocols.md)。用户/Lead已授权普通技术决策及实现，未重复请求方案许可。
- tdd：已授权公开HTTP/FlowClient seam；客户端投递边界先红（缺导出/实际API差异）再绿；MCP官方peer先红再绿；官方SSE终态race用例先暴露SDK包装cause，再修复通过。未测试私有函数以凑覆盖率。
- clean-code：指定仓库 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`，本地 `/Users/citrine/.agents/skills/clean-code/SKILL.md` SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`。本任务复用受控版本，未重复安装。
- 本地未找到专用A2A/MCP技能；先浏览 `https://skills.sh/`，再用Node24与隔离npm cache执行 `npx --yes skills find 'model context protocol'`，发现 anthropics/skills mcp-builder。实际读取GitHub原始SKILL（未安装；SHA256 `0f4592dcb53cf2b5d6b7febee6b4152018b565551a1c29e3c612f57b218ab295`）：采用官方规范/SDK优先、能力边界、错误/分页与真实peer测试方法；它以server为主，未执行不相关LLM评估或安装Inspector，不依据技能中的旧代码判断现代规范。

## 02:17 UTC 工作段clean-code复核

范围：packages/protocols源码/测试/manifest，设计与计划。检查命名、接口、职责、错误、重复、预算与行为。

发现/修复：

- 最初SDK API误用fromPartial，actual发布包只有fromJSON/toJSON；测试显示失败后修正。
- HTTP挂载与Flow业务放同factory过长，拆出a2a-http-server，官方SDK依旧独占JSON-RPC解析/dispatch；新增shutdown先终止观察连接，无cancel命令。
- 多字节body拼接风险，使用Node utf8流解码；backpressure等待使用可取消事件监听，避免close listener累积。
- card旧security字段会被v1 codec忽略，改为securityRequirements并增加官方client断言。
- 按状态与watermark读取有界历史，截取snapshot之前事件，避免晚到的artifact被映射成旧快照的内容。
- 官方SDK SSE语义错误包装于cause：observe只对明确UnsupportedOperationError重查，只有终态才能收束。不会吞auth或其他错误，不重发消息。
- SDK默认MCP legacy，显式固定2026-07-28；自动列表最多4页、单响应4MiB/15s默认边界；工具授权默认拒绝，HTTP取消不声称远端已停止。

未解决：ListTasks当前等Lead提供queryTasks公共能力；外部持久绑定/runner ownership/业务elicitation尚待下一子段；MCP Tasks实际SDK无法消费task结果，本阶段不advertise，明确不支持。独立review未开始。

## 02:25 UTC 交付前clean-code复核

再次实际读取受控clean-code；范围：全部协议源文件、manifest、6个行为测试文件、文档与边界矩阵。检查接口命名、职责、异常传播、资源清理、隐式重试和重复逻辑。

- queryTasks公共接口已整合，ListTasks不再阻塞；集合成员/顺序/状态使用中心RR结果，文档注明展开详情不是整批原子快照。
- 发现负historyLength原先到映射才报错、已产生持久受理。新增公开HTTP/真实PG回归先红，后把参数校验移到受理前（读取入口同样校验）；17项最终全绿。流式首Task沿用请求historyLength。
- 去掉未使用的直接MCP core依赖，保留官方SDK传递依赖。Flow行为映射与SDK wire职责无重复手写栈；没有因函数行数机械拆散封闭factory。
- 最终typecheck通过，针对6测试文件17/17通过，独立动态端口/flow_p01，0模型/0云。未复跑不相关产品浏览器或全库测试。
- 未解决：P01-06外部持久binding、runner ownership/恢复、中心持久elicitation、预算仍待接入；现代Tasks resultType尚无SDK支持，本库不advertise且明确失败。以上不伪装成阶段已支持。独立review仍NOT_STARTED。

## 02:28 UTC 独立review记录

Execution Lead / gpt-6-astra ultra 已批准SDK首段target `fb14d351b46da69b17e48e8815006fc320e765e1`，实际7源码与能力/interop核对、11/11独立测试。无本slice blocking；外部binding/中心elicitation/budget/Tasks仍open。此提交仅记录review与human字段，原始JSON/hash及实现无改，不重复跑测试；详细已/未执行边界见计划review。
