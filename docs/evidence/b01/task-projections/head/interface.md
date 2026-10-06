# B01 第三reader：assistant task head

Mika 2026-10-06 11:48派工，同B01 feature继续，父FLOW-001/co-lead mika/唯一owner status_read/Astra。前片c96 source/raw/manifest冻结，可由Lead独立集成；本片queries是旧manifest一个readonly输入，后续变化只影响当前WT，旧c96 Git绑定不变，不冒称原APPROVED覆盖新reader。

Interface不变：readAssistantStream(client,taskId,limit,after)仍接受caller拥有的PG client/事务；assistantStreams保持RR只读包装。文件私有TaskHead仅current_attempt_id/status/updated_at，固定SELECT三列和原404，不读submission也不复用需要JSON的summary列。cursor依当前task/attempt验证，state/blocks/settlement、limit+1/order、nullable无attempt返回、日期与状态映射不动。无公共合同/migration/index/锁/轮询改变，不造通用head框架。

验证复用已审fixture且不改其源。主样本真实公共POST合法Unicode15999字符/37331B；无attempt一条headSELECT，active常规head/state/blocks/settlement共4SELECT，有after共5。真实runner注册/claim和明确合成session/stream/final/completed事件只驱动持久数据，不启动runtime、SDK或模型。public读取HTTP与domain输出等价，当前attempt绑定/错误cursor、limit+1、completed/uncertain/interrupted、final与settlement，snapshot正文与owner401/runner403/404保持。旧stream.test.ts与client assistant-stream-production.test.ts作为只读语义参考，原全文件不运行（含本片无关runtime/SDK和弱清理fixture）。

新片red/green独立计量，最多3新tasks（red1+green2），加前片7总≤10，硬目标仍合计≤32tasks；每次45s停新增+15s清理、≤60s含初始化清理，累计解码/HTTP/证据≤32MiB。超时/未知停止不重试或FORCE。字段/rows JSON计数由原私有observer返回，不计SQL参数或正文，HTTP原已不含prompt。无wire/TOAST/I/O/CPU/吞吐SLO声明；此片SQL不引用submission，仅能证明查询不请求该列。

沿已固定本地find-skills/brainstorming/codebase-design/clean-code/tdd方法：小typed row和已有真实consumer；先red缺失投影再green，日期/状态/错误契约与资源清理核验；技能source/hash沿../skills.json，无联网安装。首片8项不再重复算本片通过，局部strict继承root基线。
