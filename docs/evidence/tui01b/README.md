# TUI01B 共享会话回执与终端恢复证据

本片把成功 HTTP 回执的必要 shape 与原请求身份校验放入 `@flow/client`，TUI通过同一纯校验入口确认受理。未知回执保留原key/body，显式恢复才原样重放。409保留草稿，刷新和轮询只读取状态；读取失败明确断开。迟到原receipt不覆盖更高revision的已观察状态。

生产目标在 manifest.json 的 implementationTarget 固定；首接口及生产代码 fb30e01b49d9a8c226975407d6de3994cb4136ad，F01直接consumer修正9c9ca357090526d728c4bab78ba78b89a6c234a3受控pick为0ae3e67f63575afcf09100a41ff0931de534022e。本片无新依赖、合同、数据库迁移。

## 实际检查

共 **70 distinct**：共享decoder46、interaction controller13、既有conversation HTTP1、TUI恢复HTTP9、stream HTTP直接consumer1。`behavior-first.txt`为69/69；随后强化同一双客户端用例并消费F01 stream fixture，`consumers-final.txt`为10/10，其中9项重复，非79个独立用例。最终 `tsc --noEmit` exit0，空stdout原样保留于types-final.txt；命令及exit见checks.json。

- client-red.txt：5项中4行为red/1pass，旧client把200空/错身份当成功或泄露JSON parser错误；client-first-green.txt 5/5。
- controller-red.txt：2行为red/11未选，旧TUI409后没有更新revision/恢复轮询，读取恢复失败却仍connected；controller-first-green.txt 13/13。
- ack-matrix-first.txt：54项中3失败是测试fixture浅复制令expected与response共享requested对象。改fixture为structuredClone后，不放松生产校验。此失败保留，不能称为3个生产缺陷red。
- install.txt：offline、frozen-lockfile、ignore-scripts安装成功。root lock未改。

## 双公开客户端的真实 HTTP 边界

两FlowClient、两interaction controllers访问自有动态loopback HTTP服务。该服务是内存中心fixture，使用CAS与不可变receipt模拟协议，不是生产PG/runner。先客户端A提交；B仍观察旧revision时提交得到409，原草稿保留，只GET刷新并恢复轮询。B显式再次发送后服务受理但回200未知shape；原key/body保留。A退出观察后fixture工作仍running且无cancel请求；A的公共client随后再提交一turn，B读取revision3。B显式恢复旧revision2 receipt仍使用原key/body，不能把当前revision降回2。最终一次读取失败让B断开。五次POST逐项断言；服务及observer清理均完成。

这证明传输/controller协议行为，不证明真实runner任务执行、PG持久恢复或provider能力。本轮未操作个人服务、Web、真实终端用户或模型。父任务要求的Web真实consumer仍外部owner接线；不能以本片标整个TUI001-09完成。

## 协议边界

- 校验输入从实际发送JSON字节取得脱离调用者的快照；不因await期间调用者修改对象而错认ACK。
- 响应追加字段保留；当前context只接受明确templateVersion1与有序完整citation tuple、range/bytes/freeze metadata。附件v2候选尚未审，不隐式接受未知版本。
- 合法响应revision上界2147483647有纯decoder用例；不声称当前中心会受理到该边界（中心有独立受理限制）。
- 共享decoder只确认receipt，不负责GET历史、Web能力显示、queue策略、journal/epoch或执行完成；Web保留这些权威。
- 接受回执不是执行成功；未知ACK可显式原key恢复，无hidden retry。确定4xx保留原draft；idempotency冲突仍保留未决intent。

## 重跑（只自有HTTP/纯controller）

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run packages/client/src/conversation-acknowledgement.test.ts packages/client/src/conversations.test.ts packages/interaction/src/controller.test.ts apps/tui/src/recovery.test.ts packages/client/src/assistant-stream.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit
```

本README列合并重跑命令，作者实际分轮命令以checks.json为准；不把建议命令说成已执行。
