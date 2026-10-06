# WPF-PROFILE01 独立审查

**状态：APPROVED**

Review target commit：4f1985769564eafad9218570411d5ce1114b4ec0

Base：4e0289f29ffa48c6c49003837d4520f57c22b6b0

范围：独立模块7个实现/测试文件；完整目录见[status](status.md)。worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-execution-profiles`，branch `codex/web-execution-profiles`。Reviewer root / GPT-6，只读；最新结论2026-10-06 04:51:33 UTC。没有新增blocking。

## 最新实际独立检查

| 检查 | 独立结果 |
| --- | --- |
| 局部tests | 16 PASS / 366ms / 04:51:33 UTC，固定4f |
| 差异与范围 | 完整a28→4f五文件diff已读；固定diffcheck0；共享未改 |
| 权限和目录 | 显式chat allowlist不随公共schema放宽；目录读取/可选类型分离；合法goal-tools/未知access保留禁选；已知goal-tools跨字段无效整页失败 |
| 双主题 | 目视新版light与390dark图 |
| CUA64954 | 20项中goal-tools/unknown两radio disabled且有原因；合法第一项Down跳至合法第四项；临时tab20已关闭；0模型 |

本轮Escape尝试工具无树变化，**不计为root新增Escape验证**。作者本轮typecheck/5HTTP浏览器与原始证据复核，未声称root独立重跑整套browser/build/typecheck。没有新的blocking finding。

## 历史检查（不替代最新target）

a28c78cc3a1ac8557f7fd95afa074c4971128246 / 同base获04:48:10限定批准，独立14tests/226ms。此前b2完整7文件审查、13tests/219ms及CUA展开details不改默认、选择/Escape返回/草稿/pending完整pin通过。该基线未知access整页拒绝策略已被4f混合目录策略替代；旧结论不声称覆盖后继。

## 限制与交接

审批仅普通聊天执行配置独立模块和隔离fixture，不含App挂载、实际消费O04共享域、真实center/runner/provider/模型、Safari/Firefox/屏读、任意每turn effort/thinking/queue/steer切换。目录中的不支持声明不是可提交Selection，中心准入仍再验ref。后继正式App接入另claim验证outbox再次parse后的ref深冻、unknown原key/body重试、pin核对后绑定、connection/draft安全。实际界面与原始证据见[报告](../../docs/evidence/wpf-profile01/README.md)，导出/消费语义见[interface](../../docs/evidence/wpf-profile01/interface.md)。

后续metadata不自动扩展审查范围；任何实现变化须新target复审。

## 集成事实（不改变审查目标）

04:58:45 UTC owner只读实核main/origin/main698ffcd94ae073b23bcc67f6665fb19f707a93e4 clean；4f ancestor exit0、7声明路径内容相同。模块已纳入主线，App串接另片。纯metadata核验，无产品重测。
