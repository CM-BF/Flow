# C fd v3：固定socket控制→regular-file对照（待独审，无运行授权）

本候选落实Mika已审的一页设计。只有host、专用entry和直接test变化；原C/profile/schema/command/R06以及report parser逐字不变。旧v2结果6b和旧窗口全部保留，不以当前同路径源码替代历史commit证据。

顺序固定：一次clang编译→同binary的socket控制→原profile下三个自有regular-file fd。只有两项，无profile/socket重复项、无第三项入口或可配置矩阵。compile/control健康或执行/关闭未知即停止；最后profile目标明确失败与清理未知独立记录，无重试。父进程在open后立即登记fd，再核regular/mode0600/path inode一致且fd≥3，三个fd唯一；子报告合法负errno保持unknown kind，不用父观测填补子观测。测量完成不代表各syscall成功、隔离或Codex可用。

新增自动compiler-inventory.json：原始两流只本地0600、O_EXCL/O_NOFOLLOW，使用同一owned读写fd写入/fsync并核文件身份、实际保存bytes/SHA，finally关闭；原流副本仍重复计artifact。清单通过有限32KiB receipt池wx/fsync保存后才进入compiler健康/parser或目标。清单close未知则标descriptorsClosed=false/保留roots，fsync失败不启动target；超过同一clock停止。CLI成功gate要求清单和结果均确认持久化。原文不console、不进Git/UI。

[检查](checks/final-result.json)：最终28通过/16未选，包含9新行为与19直接host/日志/预算消费者。先8项新要求真实red，再中间27green，最后28绑定final-source.json；中间27不累计。全部使用fake command/自有临时文件，0实际compiler/target/provider/PG。Node24直接惰性import及host/entry/test三语法检查均0；没有执行下面的参数入口。

## 新候选运行合同

[driver-input.json](driver-input.json)与[manifest.json](manifest.json)固定source、prepared实际值与既有external fingerprints。未来唯一候选命令（当前禁止执行）：

```sh
/opt/homebrew/opt/node@24/bin/node experiments/codex-app-server-conformance/fd-canary/execute-reviewed.mjs --reviewed-fd-window-v3
```

需新固定组合独审、新GO预算及Mika命名单次窗口。fresh v4/clean metadata HEAD、源码/input/manifest无变、v3预约/slots/result/compiler原流/清单不存在后才执行一次。不执行旧参数，不恢复旧clock，不更改任何grant。

预算1 compile/最多2 targets，60秒从入口hash前覆盖全部自动runtime产物/清单、cleanup、batch-result持久化、CLI写回；同步OS IO不能硬抢占，过限或未知必须如实失败。人工review/Git/归档整理发生在运行外，**不声称这些人工步骤也在60秒内**；新GO许可必须按这个明确时间边界批准，不能挪用旧窗口。

2MiB包括prepared证据、捕获流及raw磁盘副本、可见自有编译产物/报告、32KiB机器收据/CLI和128KiB人工安全归档tail。清单已自动生成，无需在runtime外再补必须的机器清单。新prepared和tail以新input/准备计量为准；旧v2 archive只绑定6b快照。本候选预留充分余量后交审；任何未来原文复制另算字节，默认只本地保留0600，Git仅metadata。全系统IO及编译器未可见行为仍不伪称全部已测。
