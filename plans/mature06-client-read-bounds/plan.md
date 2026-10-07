# MATURE06-READBOUND01 客户端响应读取上限

所属大task：[WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md)。co-lead Mika；owner db_transaction_owner / gpt-6-astra。

目标：现有 FlowClient selected metadata/patch/full block 在 JSON 解析前限制 fetch 解压后的响应字节，保持正常最大合法中心输出、认证、取消与 HTTP 错误身份；复用 native-body decoder，保留 material 和 legacy 行为。不是 TCP、heap 或 projection 3MiB 驻留测量，不新增 transport/重试/缓存。

- [x] **MATURE06-READBOUND01-01** 有界 JSON reader 单一实现，material 原8KiB/384KiB规则保持。
- [x] **MATURE06-READBOUND01-02** 三个公开 selected 方法接线；成功和错误响应均有显式接收策略。
- [x] **MATURE06-READBOUND01-03** 极值转义/envelope、分块UTF8、超限、取消、错误身份与直接消费者局部验证。
- [x] **MATURE06-READBOUND01-04** 固定源码/证据、独立review、受控main接收与唯一status同步。

实现只在已领7literal内。client/index按X01正式STOP/v22交回后本claim v2接收，保留其2ea新增pluginRunner公开接线。普通段20min、child≤60s/累计≤120s、TMP16MiB/raw0.5MiB/source+meta2MiB；Node24/Vitest4、0PG/Chrome/provider/安装，按当前组合资源门槛。

设计已由Mika接受先前只读界限研究并明确授权：readBoundedJson为内部机制；native-body领域wrapper保旧报错与上限；selected方法分别选metadata576KiB/patch448KiB/block6MiB+8KiB，错误4KiB独立限额。任意JSON可有无限空白，此为固定emitter兼容的接收策略，不声称所有合法JSON有天然上界。
