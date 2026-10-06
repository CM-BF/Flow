# WPF-PROFILE01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 04:58:45 UTC；固定main698与origin/main已实核 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | w01_owner / gpt-6-astra ultra（派发指定；上下文GPT-6） |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-execution-profiles |
| Branch | codex/web-execution-profiles |
| 工作基线 / HEAD | base 4e0289f29ffa48c6c49003837d4520f57c22b6b0；元数据停点前3919a62a02e4c07e2a28fcc9927b7bb2a56f2a3b clean；实现4f不变 |
| 工作树dirty状态 | 实现固定；本次仅主线事实与停写元数据，提交后核clean |
| 工作分支状态 | completed |
| 检查状态 | PASSED 4f1985769564eafad9218570411d5ce1114b4ec0：16局部tests、Web typecheck、5组混合目录HTTP browser；root独立16tests/CUA/源码通过 |
| 已集成main状态 / HEAD | 已集成main 698ffcd94ae073b23bcc67f6665fb19f707a93e4；4f为ancestor且7path内容相同；App接线仍另片 |
| 实现目标 | 4f1985769564eafad9218570411d5ce1114b4ec0 |
| 实现范围 | apps/web/src/execution-profiles/ExecutionProfilePicker.tsx, apps/web/src/execution-profiles/catalog.ts, apps/web/src/execution-profiles/execution-profiles.css, apps/web/src/execution-profiles/selection.ts, apps/web/test/execution-profiles.browser.ts, apps/web/test/execution-profiles.fixture.tsx, apps/web/test/execution-profiles.test.ts |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 聊天执行选项模块已纳入主线，不支持的配置会明确禁用 |
| 下一可用交付 | 把执行选项接到聊天界面 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED 4f1985769564eafad9218570411d5ce1114b4ec0；独立模块限定 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-PROFILE01-01 | completed | w01_owner | 混合目录/分页/错误/连接隔离；固定4f局部HTTP测试 |
| WPF-PROFILE01-02 | completed | w01_owner | 完整pin/深冻/显式chat allowlist/旧default；直接helper拒绝非chat |
| WPF-PROFILE01-03 | completed | w01_owner | 5组混合目录HTTP浏览器；禁选/双主题390/键盘/草稿/锁；截图已目视 |
| WPF-PROFILE01-04 | completed | w01_owner | root4f独立APPROVED，16tests/源码/CUA；App另片 |

## 输入、领取与架构影响

04:36:37.979Z新claim 17093c4c-a8fa-4e43-bc72-6bd54cab0795 v1 active；开工及后续段已live核owner/tree/9 scopes，原样[receipt](../../docs/evidence/wpf-profile01/take-receipt.json)。7新文件与2目录，不改旧CHAT/App/shared/rootmanifest/rootlock。

源码基线4e，后继合同输入只读固定02683be019ae75591b21c1ada64e01669678f068新增goal-tools；旧a28/4e审批只保留历史。4f把DirectoryProfile声明与ChatProfile可提交选择分开，未知/goal-tools可查看但禁选，其他畸形整页失败，已知goal-tools跨字段约束保留。未合入或修改O04共享域。

新增浏览器目录缓存与输入冻结Interface；不改协议/FSM/DB/运行连接。App未接入，架构图不能把模块存在当运行事实；实际集成时由Lead判定图更新。

## 验证与独立审查

[报告](../../docs/evidence/wpf-profile01/README.md)、[原始browser结果](../../docs/evidence/wpf-profile01/browser-results.json)、[Interface](../../docs/evidence/wpf-profile01/interface.md)、[技能与clean-code](../../docs/evidence/wpf-profile01/quality.md)。Node24 / pnpm9.15.4 / Chrome154。16作者局部tests+typecheck+5HTTP browser通过。隔离fixture生产bundle仅历史b2曾通过，4f未重跑，不冒充当前App生产组合。

root / GPT-6只读，04:51:33 UTC正式APPROVED target4f/base4e。独立16tests PASS/366ms、a28→4f五文件diff/diffcheck0、目视新版双主题图；CUA64954确认goal-tools/unknown两radio禁用且有原因，合法第一项Down跳到合法第四项。临时tab20已关闭，没有新增blocking。本轮root Escape未观察到变化，不计新增验证；此前旧UI与作者本轮证据来源分别记录在review。

## 启动与未验证

`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/execution-profiles.browser.ts --serve`，每次独立动态端口；当前保留 http://127.0.0.1:64954。旧62662已核自己PID/cwd后清理，未动4320/49922/其他owner服务。

0模型/0DB。未验证App组合、真实center/runner/provider/模型、Safari/Firefox/屏读或实际O04共享域消费。profile声明不证明online/effective；App另领接线须验证unknown原key/body、再次schema.parse后的ref深冻、ACK pin匹配后绑定、已创建锁及draft/center lifetime。frozen-lockfile安装复用449包，根manifest/lock diff0，client/contracts均本树workspace链接。

## Dashboard与handoff

04:53:18.107Z实际4320 source HEAD a2130834639491c38e88e9303b15f23012ead376 clean；human.complete=true/issues=[]，checks passed target4f，review.state=approved/target4f、review.proof和implementationProof均unchanged；main not-contained；claim17093 v1 active matchesSource。原样[最终采样](../../docs/evidence/wpf-profile01/dashboard-final.json)。04:44旧snapshot仅历史，不作为新review解析依据。

交管理者/原Execution Lead与App owner固定target4f；后续metadata不扩approval。等待独立App领取接线，保留本claim修复权，不merge main。


## 主线事实与停止写入（04:58:45 UTC）

独立只读核main与origin/main均为698ffcd94ae073b23bcc67f6665fb19f707a93e4且主仓clean；`git merge-base --is-ancestor 4f1985769564eafad9218570411d5ce1114b4ec0 698ffcd94ae073b23bcc67f6665fb19f707a93e4` exit0，声明的7实现/测试路径diff为空。模块集成与App挂载分开，本次0产品测试/0模型。

本次元数据提交后明确停止claim17093c4c-a8fa-4e43-bc72-6bd54cab0795的全部9scope写入；依据当前v1执行release。receipt交管理者保存，release后不回写本canonical。后续修复需新take；不是handoff给未知owner。此段记录停写及释放意图，实际release以D04 committed receipt为准。
