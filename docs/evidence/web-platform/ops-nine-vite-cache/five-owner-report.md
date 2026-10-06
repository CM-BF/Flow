# 五个 `.vite`：仅既有预览／退役证据

**本轮可提交清理候选：0。** 三树明确保留预览，另两树只有实验cleanup／无新常驻预览声明，没有将该exact cache正式退役的完整依据，均KEEP。报告不判断端口当前活性，不代替Lead组进程与目录身份核验。

共同父 `/Users/citrine/Projects/AgentHarness/Flow-worktrees`；每行唯一目标为 `<树>/apps/web/node_modules/.vite`。完整绝对路径、固定HEAD、原句／行号／hash见audit.json。

| 树（固定HEAD） | 既有预览／清理事实及精确依据 | 结论 |
| --- | --- | --- |
| web-execution-profiles（7f10889d） | `plans/wpf-profile01-execution-profiles/status.md:48`、`docs/evidence/wpf-profile01/README.md:30` 明确保留64954；旧62662已清理。04:58:45停写只指任务scope。 | KEEP；旧preview退役不覆盖替代preview64954。 |
| web-profile-integration（07cffeba） | `plans/wpf-profile-integration/status.md:36`、`docs/evidence/wpf-profile-integration/README.md:9` 明确保留51832/session68857，并注明独立进程不归自动test cleanup管理；05:18 main-close仍保留。 | KEEP；交付与测试清理均不等于该预览退役。 |
| web-visual-shell（558895d7） | `docs/evidence/wpf-visual01/README.md:9,20` 保留production53047/session64287和development65126/session28071；自动测试动态fixture独立清理。09:42:20 main-close未撤回此保留。 | KEEP；尤其dev preview未有正式退役证据。 |
| web-workspace-cache（10ca8eef） | `docs/evidence/wpf-workspace-cache/README.md:11` 无常驻新preview、实验自有服务已清理、旧服务未操作；`validation.md:9` 七轮68.689秒均fulfilled。status的11:57:35交付/停写不是缓存退役回执。 | UNKNOWN／KEEP；仅能证明指定实验清理，不能认证所有长期／外部cache消费者消失。 |
| web-workspace-lifecycle-baseline（12e4f3f4） | `docs/evidence/wpf-workspace-lifecycle-baseline/README.md:9` 不常驻预览、own实验服务已清理；`validation.md:7,9` 第二轮11:02:57.972结束cleanup85ms/无错，但第一轮没有完整cleanup审计。 | UNKNOWN／KEEP；不把第二轮cleanup或旧进程观察扩展成整个cache正式退役。 |

Recovery/DPERF/Settings目前已知declared依赖donor不是这五树（前两者attachment-production，Settings主要m2-integration），这条既有事实只能排除那些明确donor关系，不能取代以上preview事实。没有遍历全部依赖／其它Lead动态引用，也没读取个人配置或任何cache内容。

方法沿已读本地find-skills/clean-code：复用明确owner证据，区分产品交付、某次测试cleanup、长期服务退役三种事实；未安装技能。只读固定文档Git对象＋/tmp报告。0进程/端口/页面/HMR访问、0du/free、0build/tests/Node imports/依赖操作、0服务停止、0项目或配置写。若Lead后来得到正式退役与无consumer证据，须另以其时点／exact路径判定，本报告不授操作权。
