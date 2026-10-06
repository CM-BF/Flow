# WPF-PROFILE01 新会话执行配置模块

| 字段 | 内容 |
| --- | --- |
| 计划编号 | WPF-PROFILE01 |
| 状态 | completed |
| 创建 / 更新 | 2026-10-06 04:49 UTC |
| Owner / model | w01_owner / gpt-6-astra ultra（派发指定；运行上下文为 GPT-6） |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-execution-profiles / codex/web-execution-profiles |
| 基线 | 4e0289f29ffa48c6c49003837d4520f57c22b6b0 |

目标：选择中心声明的整份 execution profile，生成深冻结的新会话输入，支持未知创建回执期间及已创建后的只读配置。旧无 pin 会话保持兼容；配置、模型别名、实际 effective 和服务在线状态不能混为一谈。此模块不发送会话、生成 key 或接管 outbox。

用户已授权此独立模块。准确范围以 [D04 receipt](../../docs/evidence/wpf-profile01/take-receipt.json) 的 7 个新文件与 2 个目录为准；App、ConversationThread、projection/outbox、公共合同和根 manifest/lock 不改。实际 App 接入由对应 owner 另行领取，此交付不冒充产品已接通。

## TODO

- [x] **WPF-PROFILE01-01** 目录分页、刷新/错误/中止与连接隔离的不可变投影。
- [x] **WPF-PROFILE01-02** 整份配置选择、深冻结 creation、完整 pin 回执核对、旧无 pin 兼容。
- [x] **WPF-PROFILE01-03** 受控选择器与 HTTP fixture；浅深主题、390px、键盘、错误恢复和未知回执锁定。
- [x] **WPF-PROFILE01-04** 独立审查、修复、固定模块交接；主 App 集成另领。

## 设计与验证

采用既有 Dialog/Button 与原生 radio，显式 Load more，不引入 cmdk 或远端 logo，不把已读第一页过滤当完整目录搜索。模型相同而 runner 不同必须独立显示。thinking 固定 disabled，effort 不支持，access 取所选整份配置；CREATE 后锁定，不能伪装热切换。

目录刷新保持旧页可查看但标陈旧，失败保留；401 也不清空已冻结输入，陈旧目录不能产生新选择。loadMore 保留已读页及游标用于重试。dispose/refresh 取消旧请求且 generation 拒绝迟到响应。选择不随刷新自动改变。

测试通过公开模块接口与真实 FlowClient HTTP fixture；不调用模型/数据库。只运行本模块与类型检查、隔离浏览器。未验证真实中心/runner/provider、App 接线、Safari/Firefox/屏读。方法及实际发现见 [quality](../../docs/evidence/wpf-profile01/quality.md)，接口见 [interface](../../docs/evidence/wpf-profile01/interface.md)。

本模块交付已获独立APPROVED target a28c78cc3a1ac8557f7fd95afa074c4971128246；completed仅指本计划模块范围，App接入与真实中心另片，见review边界。

## 02683后继差异

2026-10-06 04:50 UTC Lead固定02683be019ae75591b21c1ada64e01669678f068扩展goal-tools。恢复01/02/03/04已有稳定TODO的后继适配，保留历史a28完成证据：DirectoryProfile仅目录声明；Selection必须显式none/configured-readonly allowlist。混合页保留goal-tools/unknown禁选项和cursor，已知goal-tools无read approval/空material约束继续验证。新target独立复审后才称后继完成。

后继02683适配已在4f独立APPROVED（04:51:33 UTC），16局部tests+混合目录真实UI复验通过；模块完成，实际App另片。
