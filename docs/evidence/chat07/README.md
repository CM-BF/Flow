# CHAT07 持久 active-steering 首片

仅中心领域与可组合事务 seam；没有生产挂载、runner消费、SDK streaming-input、interrupt、Web功能或模型调用。默认受理关闭。旧 final 事件主线未调用 seal，不能把本片的竞争验收解释为整个产品已能安全 steering。

## 已验证的路径

实际 Fastify `createServer` 的 owner/runner 鉴权 + 动态端口 + 随机独占 `flow_chat07_*` PG 数据库；runner注册、task受理、claim与session事件走现有真实HTTP，随后测试本模块命令/读/receipt。无模型或认证网络。最终回复竞争由测试专用HTTP组合 `sealForFinal` 和现有 `saveAssistantFinal`，同一PG事务；此端点不在生产模块。

- `checks-final.txt`：16/16，3.516s test time、4.00s总时间。含两HTTP指令竞争、指令与final竞争，以及持有真实runner行锁时另HTTP在PG确实等待，提交后拒绝迟到指令。
- 命令与received/observed-consumed/rejected/unknown分别持久。runner真实身份、current attempt/ownerVersion、lease、任务状态、native session在幂等查询前核验；七种失效分别检查。单在途与unknown不重投、不建立新task。
- UTF8正文16KiB，中文/emoji边界、NUL/不合法scalar拒绝。metadata及审计无正文；owner+task+command绑定读取、原文digest验证、no-store。
- 同key同输入恢复receipt，异输入拒绝；receiptRevision与控制revision分别负责回执/新命令，控制revision不是内容缓存水位。取消/完成后的旧命令保留历史，attemptAvailable=false，不推断本机执行已停止。
- final写入后的合成失败让seal/final/audit一起回滚；相同seal身份幂等，其他身份冲突；pending/unknown不许seal。中心重启保留命令、收据和不可变审计。
- 首次024升级专用第二随机数据库：只运行既有v1/v2迁移、写旧task，明确确认024/steering表不存在，再第一次迁移、核旧行不变/新表空/第二次幂等。不是新schema上的no-op冒充升级。
- `typecheck-final.txt`：全库TypeScript检查 exit0。未跑全产品测试。

`red.txt` 是原公开HTTP红（501 vs202）。`first-green.txt` 是服务模块直接导入未声明zod导致加载失败，不是行为红；已将query schema放到已有contracts依赖，未新增依赖。`first-green-fixed.txt` 为1/1；`checks-iteration.txt`为中间14/14，最终新增缓存/历史/正文完整性与重启receipt断言16/16。原输出保留不覆盖。

## 重跑

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/active-steering/steering.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```

需要现有本地PG测试设施127.0.0.1:55432与仓库非秘密fixture角色flow；测试创建随机数据库并finally关闭HTTP连接/center/pool、DROP自己的数据库，不访问个人预览数据。生产服务61227/61228、4320等不操作。

## 后继与限制

observed-consumed仅认证runner的源帧关联声明，received更不等于模型遵从。现片没有原生消费，所以不能声称active steering已提供给用户。未知回执保持未决，不自动释放或静默重发；未来真实runner输入UUID、消费观察和恢复须再验收。控制revision仅新受理CAS，列表应重新读取或按独立audit cursor观察变化。正文最多16KiB不分片，不创建通用blob/队列/控制循环。

scope与接口见[interface](interface.md)、[plan](../../../plans/chat07-active-steering/plan.md)。实现固定target与原始文件hash在manifest；独立review默认NOT_STARTED。
