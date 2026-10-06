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
