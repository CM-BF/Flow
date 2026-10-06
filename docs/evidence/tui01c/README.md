# TUI01C — shared stream and lazy activity evidence

本片让终端自动观察一个回合的逐段正文，并显式读取活动/完整回复。Web与TUI共用浏览器安全stream协议和中性BodySegment；各自renderer、Web私有host/store保留。无新的HTTP合同、依赖库或执行循环。固定源码目标及逐文件hash见`fixed-manifest.json`，作者不作独立批准。

## 实际检查

122 distinct：基础直接消费者30 + HTTP观察10 + 真实PTY1 + Web直接消费者81。以下多轮为增量验证，重叠不累加：

| 原始输出 | 命令范围 | 实际结果 |
| --- | --- | --- |
| direct-initial.txt | controller/terminal/recovery/shared presentation/read-budget | 30/30 |
| http-second.txt | 新HTTP观察首7条 | 7/7，后续9条轮次覆盖 |
| reply-page-final.txt | HTTP前9条 + Web stream32 | 41/41 |
| activity-stale-final.txt | 新增活动stale例 | 1/1，9未选 |
| web-direct.txt | native activity9、activity integration7、stream integration11、projection22、stream32 | 81/81 |
| terminal-final.txt | controller13、terminal4、实际PTY1 | 18/18；13+4与首30重复 |
| pty-final.txt | 实际PTY+退出后的headless重连 | 1/1；与最终18重复 |
| types-final.txt / types-final.exit | 最终root `pnpm typecheck` | exit 0 |
| web-types.txt | `pnpm --filter @flow/web typecheck` | exit 0 |
| web-build.txt | `pnpm --filter @flow/web build` | 成功；保留既有大chunk警告 |
| web-install.txt | offline frozen ignore-scripts安装 | 成功；无第三方新增 |

重跑必要片段示例（Node24）：

```sh
pnpm exec vitest run apps/tui/src/observation.test.ts apps/tui/src/stream-pty.test.ts
pnpm exec vitest run apps/web/test/conversation-stream.test.ts apps/web/test/conversation-stream-projection.test.ts apps/web/test/conversation-stream-integration.test.ts apps/web/test/conversation-activity-integration.test.ts apps/web/test/native-activity.test.ts
pnpm typecheck
pnpm --filter @flow/web typecheck
pnpm --filter @flow/web build
```

先确认实际文件名；最终manifest保存所有原输出，不通过命令退出包装伪报。所有新HTTP为自有临时listener和内存合成状态，非PG或provider。真实PTY启动实际Ink入口，看到两次可见正文增长、redacted不请求正文、截断片段和OSC转义；Ctrl-C恢复raw mode，中心fixture任务仍运行，退出后最终结果可由实际headless入口重新读取。最终记录17,217 bytes / 2.987s为该PTY样本，不是容量或首token统计。

## 失败与修复

- shared-red：模块尚未创建的加载失败，不称行为红。
- http-initial：合成fixture source/body字段不符固定合同，修fixture后7/7；不是provider失败。
- pty-initial：实际PTY部分通过，后续root eval无法解析workspace包；改为实际headless入口。
- types-initial：Detail DTO并无task/attempt字段；采用已绑定conversation/turn路由+ref id/kind，并核typed digest。
- web-direct-red / web-build-red / types-web-red / web-types-red：提取时漏闭合括号/identity导出；补齐后81、构建与types通过。
- reply-red：真实行为红——非截断preview掩盖了错误的显式完整detail。完整内容现在优先参与digest核验；错误detail不发布。

## 有界与剩余范围

单观察turn、2个实际并发read/4等待、活动20引用/页/4份64KiB body cache；stream沿原1MiB/256blocks/4096patches；完整final detail上限沿1MiB合同。显示仅2,000字符窗口，可显式前翻，原文未截断。活动body、可公开thinking与完整final detail均为显式读取；redacted无body请求，truncated仅片段且无原文剩余回取能力。未知/gap/失败不推断完成，退出只停止观察。

0provider、无真实模型/SDK能力/费用/首token测量、没有本片PG验收；未触个人服务。本片实现期间另按单独SVC04授权进行了Web发布，其证据仅在SVC04 canonical，不算本片验证。headless是同handler的命令快照，不是自主token事件流。较旧历史分页、附件、queue/steer/cancel/decision等仍属TUI-001后继。
