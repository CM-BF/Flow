# 阶段源码复核入口（非正式候选）

2026-10-06 14:33 UTC。针对82d78早期只读反馈，以下是源码处理位置，不是行为测试通过。源hash与最新types执行字节见 app-wiring-third-types.json；独审状态 NOT_STARTED。

| 来源 | 反馈 | 当前处理 | 仍待行为验证 |
| --- | --- | --- | --- |
| root 1 | prepare失败后empty覆盖源稿 | recovery/binding.tsx prepare只成功endHandoff，失败保留handoff/deferred/原记录 | save→commit拒绝→empty→重开源稿 |
| root 2 | version++不是真CAS | recovery/journal.ts bind版本期待值在同RW事务比对，accepted禁止倒退 | 两port dispatch/迟到checkpoint |
| root 3 | A排队写进B、迟到restore | binding enqueue/restore捕获并复核namespace+generation | 切中心/授权epoch异步隔离 |
| root 4 | storage失败伪rejected/新key | Outbox/Queue/Steer保unknown+locallyBlocked、原key重试；原receipt同步交接 | 0HTTP/同key、材料保留 |
| root 5 | logout await前仍授权 | connection/session.ts同步撤publicauth/CSRF，再私有捕获CSRF一次logout | 私有logout在途业务被阻止 |
| w01 A | 终态恢复成unknown | outbox accepted仅打开；rejected真实状态；Queue/Steer保checkpoint终态 | 不可误重发/复原身份 |
| w01 B | resolved旧knowledge仍unverified | conversation-context/controller.ts readBody成功删除unverified | search缺旧版但显式resolve后可用 |
| w01 C | 255合法filename被拒 | attachments/controller.ts及binding复用公共NameSchema | 完整accepted.resource恢复 |

额外源码检查：只put新增/修改record，不重写其他draft；snapshot.records先复制避免push同时污染原记录比较基准。路由由draft→conversation后同stablekey触发保存，dedupe包括owner而非只正文；alias冲突不能把已存在另一个draft身份静默替换。ConversationBehavior按当前宿主是否配置durable恢复准确说明，旧fixture保持page-local边界。

直接测试源码13项，当前仅typecheck0，未运行。mock IDB事件端口不替代真实浏览器事务/跨tab/重开；实际App HTTP fixture/browser仍未完成。中心三语义待最终固定核验，旧upload journal跨tabCAS/历史目录namespace不在此片修复。

## f13 后续源码修复

- F13-1：binding.prepare 在await前绑定authority，逐await再核；同namespace提交后跨reauth只记实际draft version，不自动续发。
- F13-2：BrowserWorkspace持有旧namespace/session/client，身份变更经旧private flush guard，失败保inactive旧实例；明确discard仅页面状态。
- C1：原record恢复携expectedVersion，迟到prepare不能领当前version；同key accepted checkpoint阻止重送。
- w01 P2：Outbox/Queue/Steer同key同材料终态对账，CREATE先绑定再freshGET，原下一稿不被命令authority改写。
- w01 P3：restored未验证knowledge即使缓存存在，显式expand也走fresh resolve。
- F13-3：failed/blocked open清对应promise，晚success关闭orphan，新attempt不被旧callback替换。
- C2：生产App仅cookie入口，默认unsupported中心不能当Bearer fixture已有恢复支持；interface明确部署门槛。

本安全点全部仍是源码修复+noEmit，单文件行为检查尚未执行。实际App auth/identity保持仍需后续browser验证。

## R4-1 与首轮行为

4ba固定20/20 direct PASS（受控IDB事件端口/public-client mock fetch），runner实际2.540秒、cleanup fulfilled；此轮不包含R4-1时序。随后binding DraftState显式绑定namespace，将commit得到的CAS version记录于该旧view状态，即使publicnamespace暂null；仍经current gate拒绝旧send，恢复授权只有用户明确操作可重试。新case控制auth=false/namespace=null→commit→同namespace reauth→旧port仍拒→新明确retry成功。跨namespace不借用版本；这项当前仅源码+types0，后继direct待fresh窗口。

补充terminal binding残留：关联handoff.commandId，commit转移后版本归零不恢复授权；host成功匹配同key terminal后、current代际核准才清该ID blocker/endHandoff，并持久保存deferred下一稿。错误身份Restore不清保护。新增binding级case未执行，不能引用原20case绿。
