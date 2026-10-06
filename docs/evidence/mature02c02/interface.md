# MATURE02C02 首片 Interface

固定输入 main eae85567ba5dfb650ba71b473917130f87b5945c。本片只使用现 R06 transport 和 exchange；不复制 session/fence/取消 FSM。

| Module | 输入/输出与所有权 |
| --- | --- |
| profile + server admission | optional host-owned 无default；旧字段缺失明确unsupported。task只传完整profile reference与native session ID；中心现runner/session锁判定。 |
| session-storage（新增小私有模块） | trusted host的固定自有目录、初始dev/ino、runner/config binding和factory；输出不可由HTTP制造的handle。它持有真正绑定codeHome的factory。目录由host所有；不管理auth/registry，不声称OS强隔离。 |
| adapter/guard | 复用已验证task pin与context.executionIdentity；核handle绑定与目录identity后才factory。错误只有限mismatch/unsupported/unknown，不带auth身份值、path或handle内容。 |
| wire + exchange | start ephemeral:false或resume ID；resume只发送固定0.154声明字段，excludeTurns:true；thread ID逐字匹配后才turn/start。R06仍唯一process/stdio/close owner。 |
| public task API fixture | 两个独立transport实际使用同一own fixture目录，首轮close后第二轮读同session材料；中心确认同runner/session锁。只证明注入接口边界。 |

首片仍普通 read-only：engineering writer不进入此persistent分支，原start/ephemeral:true默认不变。未知start/resume/turn ACK与close保持unknown，禁止自动newthread/fallback/重播。browser disconnect只结束观察，不连接runner取消。

## 兼容与反例

status_read独立只读设计检查指出旧native-v1严格整页reader拒绝未知sessionPersistence。已接受在listNativeProfiles查询LIMIT前排除新opt-in，保持旧完整配置/digest；public task API fixture可直接用自己的publishNativeExecutionProfile回应pin，无需目录列出该profile。混合旧/新profile与limit页是必要直接验收；新目录/Web/TUI仍待后继，不剥字段伪造digest。

必要行为：缺handle；目录identity改变0factory；runner/profile不符；同根真实读写的两transport；恢复ID不符0turn；unknown ACK无fallback；旧profile序列化/拒resume；engineering default不变；server公开session并发/错runner拒绝；观察者退出后台继续。

## 固定 schema 与来源

既有生成文件（仅只读，未启动schema生成）：
- /tmp/flow-e02-schema.6svf7w/ts/v2/ThreadResumeParams.ts，2119B，SHA256 02f6d2d99d1cfb42ca2ef4647d731fee0b3801c25a61451b41f041b97adff649。
- ThreadResumeResponse.ts，1686B，SHA256 98bd0d6fe7bb5e6d95d223e9fecf1282dd1af3be821b201ce7db57fe74b0b3e7。
- ThreadStartParams.ts，1292B，SHA256 3a8e4943c6a9a86de42037096cedb86ac6abef491fb7ca424752663116c24fef。

resume实际type没有ephemeral/history/path，不照历史注释发送这些字段。[官方App Server文档](https://learn.chatgpt.com/docs/app-server)说明恢复再发turn的流程；current文档不能代替固定0.154 schema。目录存在不能推账号entitlement。

## 后继生产路径（本次未领取）

R05D main.ts、configuration.ts/.test.ts、codex/launch.ts/.test.ts、execution-profiles.ts/.test.ts与main-concurrency.test.ts需要把实际固定codeHome接到trusted native factory；启动通知/系统配置/权限按生产边界单独验收，不把实验caller挪成框架。conversations state/replies/queries及assistant reader由REQ15当前owner协调；typed合同/中心/client/Web/TUI另扩精确scope。

未来真实两轮仅提案：固定0.154 binary、已观察目录中的gpt-5.6-sol/low/默认tier；资格和实际model仍unknown。auth只能来自另行明确授权的trusted宿主来源，缺失即NOT_RUN，不读个人auth/config、不登录或refresh。拟最多2process/2turn、120s含cleanup、每轮保留文本≤1KiB/总诊断≤2MiB；这些不是已授权额度，也不能构成模型账单硬上限。先确认来源/费用门禁再独审开窗，两轮中间保留同identity私有存储，最后依明确cleanup策略处理。当前0真实请求。
