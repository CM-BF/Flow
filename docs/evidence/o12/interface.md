# O12 Interface — implemented contract

固定基线52ebd2b1，复用O11公开GET /api/goals/:id/delivery。目标会话绑定一个goalId与一个connectionId；owner凭据留公共FlowClient宿主，不持久写入intent。

## 历史解释

- `view=explanations&limit=1..50&after=<opaque cursor>`：首请求读取goal当前explanation_version作为throughVersion；之后按version升序在固定上界内分页，响应 `{view,goalId,throughVersion,items,nextCursor}`。items仅`{reference:{goalId,version},kind,createdAt,source}`，不带text。cursor绑定goal与上界。无全文扫描、无总动态snapshot hash。
- `view=explanation&version=<positive int>`：返回`{view,reference,explanation,historical:true}`；精确immutable解释，旧节点/输入变化不改该正文，不表示当前有效性。当前状态仍读state。
- owner权限/no-store沿原路由；400非法参数/cursor，404错误goal或固定版本。列表每页最多50；正文仅一条既有生成记录，无migration。

## 会话控制器

`createGoalSession({client,connectionId,goalId,intents,makeKey?})`；`initialize/plan/observe/history/read/command/recover/snapshot/subscribe/disconnect/dispose`。无内建无限轮询：renderer/host显式observe，复用ObservationReads限制2并发+4排队；缓存最多200计划节点、50状态节点、1页历史引用、1显式正文。subscribe仅本地状态通知。

read严格分goal/input/decision/explanation/artifact引用，正文不会跟状态刷新自动再读；artifact先在同goal已观察的权威binding中核task/node/detail关联，再核公开detail的id/kind/artifactVersion和正文digest；detail本身不含taskId，不能声称单独detail证明task归属。历史input/explanation缓存只存当前展开项；state不掺prompt。

统一command为goal(既有GoalCommand，execute必须fixture)、project(既有CAS)、decision、cancel。projectId由本goal已读取plan确定；decision/cancel限本goal当前观察到的task及node归属。所有修改先冻结解析后的JSON/key/body并持久保存。仅一个未决intent；新命令不得覆盖unknown；store命名空间connectionId+goalId，宿主负责持久原子保存/独占。payload最多64KiB。

网络/中断/无法验证ACK均unknown，保留key/body；recover只显式发送完全相同intent。首次明确4xx为rejected，特别409只恢复观察不自动重新派命令；unknown恢复遇拒绝仍保留unknown，不能推断此前失败。receipt确认后若store清理失败，intent仍可安全原key重报。读状态不能把未知写改成acknowledged。

disconnect停止本地观察/请求，既不cancel task也不改变中心事实；dispose等待已开始命令持久化/收尾，无后台资源。native owner执行后继单独动作，不偷偷让fixture execute变native。业务accept必须显式，mechanical verified不是语义验收。

## 验证与扩展

零模型公开HTTP/PG：超过50解释分页夹入兄弟更新、固定正文；双实例同version冲突；commit后丢ACK→重建controller恢复；decision/cancel；陈旧input拒绝；真实请求/UTF8响应bytes与重复材料计数。局部故障只注入transport/IntentStore边界，中心规则不mock。新renderer只实现IntentStore并订阅此模块，不复制调度/版本规则。

Shared由Lead：`@flow/interaction/goal` package export；client detail/decide/cancel可选AbortSignal。其他既有client方法和新query union直接复用，无新依赖。

实际签名见 packages/interaction/src/goal/types.ts 与 index.ts。历史reference是既有goal_id/version复合identity；列表cursor不是新的授权令牌。当前renderer调用observe触发实时读取，不自动轮询或模型调用。plan相关变化清除旧state并拒晚回的旧观察；已展开immutable正文保留不强制重读。read返回值与snapshot缓存隔离。IntentStore失败也维持unknown，显式recover先确认同intent已存再发；store拒绝本身不证明是否落盘。
