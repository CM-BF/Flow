# CHAT02 最终正文持久片段

当前实现 `2e1098504500a472f50a4f77e57c8220a48b28aa`，基线 `7808126daeb66e2e295d32e182639dc709f28aa1`。模块作者66/66局部检查和typecheck通过，Execution Lead独立APPROVED。生产共享挂载37ab367完整merge后，测试delta fcbc248再获只读APPROVED，正式入口10/10整suite（7.40s）与typecheck通过；未宣称main或产品接线完成。

Claude SDK0.3.290成功result且is_error=false的result字段成为唯一正文。读取iterator直到结束，忽略partial/assistant多块、thinking、tool和子任务输出；同一个最终result重复只产生一条，冲突结果拒绝，不拼凑草稿。中文与emoji原样保留。来源保存native session/result UUID、稳定messageId、中心派生task/attempt/event/sequence，以及requested与init报告的effective设置；无报告值明确null/unknown。

assistant-final通过已有durable outbox和fenced连续事件事务保存。须先存在匹配session，每attempt只有一个不可替换的final；不同token/fence/session或伪造conversation字段均拒绝。原artifact/独立verification保持，typed final本身不等于任务完成或验证通过。CHAT01按已绑定task/currentAttempt读取并独立判断可接受状态；新adapter v2缺typed final不能冒充v1 artifact兼容来源。

正文复用flow.details，009只新增assistant元数据表。轻列表默认20/最大100，正文及完整设置按需读；大正文回归约490KB，列表小于3KB。readAssistantFinal仅接受taskId/attemptId，核对正文归属与digest；不让runner指定conversation。

## 原始检查

- [adapter先红](adapter-red.txt)：原adapter无typed final；修复后正文/来源实际输出。
- [中心先红](center-red.txt)：原事件端点返回unsupported_event；修复后真实PG保存/查询。
- [歧义结果先红](result-conflict-red.txt)：不同result会被末条静默替换；修复后拒绝。
- [最终66/66](checks.txt)，9.09s：adapter25、真实HTTP/PG10、既有runner25、client4、contracts2。[typecheck](typecheck.txt)通过；frozen安装通过，未新增依赖或根锁变化。
- 10条HTTP/PG含真实center重启、session顺序与全batch回滚、重报/异内容冲突、foreign credential403与错误fence409、非法归属字段400、有界轻读/权限、过期拒绝和错误结果无final。
- 两条恢复用例使用公开runRunner+真实HTTP/PG，分别在final保存之前/保存之后丢ACK。旧runtime停止，确认磁盘pending envelope已保存；重启真实中心和新runRunner，恢复同eventId/sequence/attempt/正文，只调用合成SDK iterator一次，未重复执行任务。此证明进程内全新runtime实例恢复，不是OS硬杀或断电持久性证明。

[manifest](manifest.json)固定9个源码文件、5份stdout及锁定SDK d.ts的SHA256。Node24.20.0、pnpm9.15.4、Vitest4.0.18、本机loopback PG16。专库flow_chat02已删除，动态端口/临时目录受控清理；没有停止4320或其他服务。

## 复跑

测试仅使用本机55432的专用flow_chat02；存在该库时拒绝覆盖，advisory lock保护本用例重入。需要本机开发PG用户可创建/删除此专库。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/runner/src/claude.test.ts apps/server/src/assistant/assistant.test.ts apps/runner/src/runner.test.ts packages/contracts/src/contracts.test.ts packages/client/src/client.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```

SDK真实导出类型与[官方输出流文档](https://code.claude.com/docs/en/agent-sdk/streaming-output)、[官方agent loop说明](https://code.claude.com/docs/en/agent-sdk/agent-loop)共同核对：content block不等同完整回复，result可带错误，尾随system仍须读取。未升级SDK，不因最新网页猜测旧版本字段。

## 边界

0真实模型/0云调用。未运行CHAT01/UI浏览器、流式delta、真实自然语言语义、多进程同runner、公网故障或OS断电实验；未宣称model/queue/steer前端控制生效。有效设置来自SDK init自报，不是中心独立认证。后继CHAT02-05保持open，完整目标不因本片段通过而完成。

## 正式中心入口与清理限制

[生产10/10原始stdout](production-checks.txt)、[typecheck](production-typecheck.txt)、[生产hash与目标](production-manifest.json)。测试必须由createServer自行挂载两路GET及009迁移，原fallback已删除；只重跑10条模块检查，没有重复66。

首次10条行为均绿但afterAll关闭超30s，[整suite失败](production-cleanup-failure.txt)如实保留；[阶段诊断](production-cleanup-diagnostic.txt)发现已取消的runner claim仍留在HTTP关闭阶段，DB连接idle、尚未进入scheduler/pool关闭hook。完整停止所有runner promise与SDK query后，测试明确断言两者为0，再关闭该测试app自有HTTP连接并等待app.close，之后DROP自建专库。没有强关运行中的SDK、删除业务断言或扩大timeout。

诊断重跑先遇到遗留专库时按保护规则[拒绝覆盖](production-preserve-existing-db.txt)，不算有效测试；核验该库为自己失败用例所建、独占锁可取且没有连接后才受控清理。生产优雅停机是单独后继风险；本片段没有修改生产server.close行为，不能把fixture清理通过当生产shutdown已修。
