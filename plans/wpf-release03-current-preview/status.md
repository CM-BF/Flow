# WPF-RELEASE03 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-06 15:34:33 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | w01_owner / gpt-6-astra / ultra |
| 所属大task | [WPF-MATURE-01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-01-visual/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-current-preview-compatibility |
| Branch | codex/web-current-preview-compatibility |
| 工作基线 / HEAD | 362af3bac77541e5a60979326bcf4d4b8c947915 / dbaa88fa7a5adf1da077be7739842b6e42664c26（后继源码固定） |
| 工作树dirty状态 | 负兼容676f双端clean已核；新源码dbaa已提交，本段仅计划/证据待提交，最终clean另核 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | NOT_RUN dbaa88fa7a5adf1da077be7739842b6e42664c26（新后端重绑）；旧432b实际A两项FAILED，B未运行 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；新后端重绑待独审；旧A失败/新组合未运行 |
| 实现目标 | dbaa88fa7a5adf1da077be7739842b6e42664c26 |
| 实现范围 | apps/web/test/web-current-preview.fixture.ts, apps/web/test/web-current-preview.browser.ts |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 附件历史问题已定位，修复版本的验证入口已准备 |
| 下一可用交付 | 后台最小修复后继续未完成的真实前端验证 |
| 当前阻塞 | ACTIVE: 原后台附件历史检查失败；等待固定修复版本、来源审查和新的运行准入 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，新重绑源码及完整兼容审查NOT_STARTED；旧432b源码条件APPROVED |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| RELEASE03-01 | completed | w01_owner | [固定源码审查](../../docs/evidence/wpf-release03/source-review-432b.json)、[manifest](../../docs/evidence/wpf-release03/source-manifest.json) |
| RELEASE03-02 | pending | w01_owner | [实际A结果](../../docs/evidence/wpf-release03/history-result-152729.json)：2/2失败，累计3,874/180,000ms；B未运行 |
| RELEASE03-03 | pending | w01_owner | 432b源码条件独审已通过；root已独立核实际A失败原始证据；B/主线交付未完成 |

## 架构影响与未验

仅独立验证脚本，产品/共享/原 SVC 工具不变，无架构图更新。已知后端附件 history 缺口必须先测，不将受理成功当全链兼容。本轮实际单专库HTTP原生事件模拟；0安装/build/Chrome/provider/个人入口操作。

## Dashboard 与交接

唯一 source 是本 status；首提交交管理登记，当前未声称真实服务卡已上线。领取见原样回执；本次唯一A授权已执行完并交回窗口，不自动续跑。

## 历史来源与轻量准入

首canonical422d0fba已normal push并核local=remote。两脚本当前只做作者源码审查，未执行。17links本人live核v2后按原proposal建立并逐一realpath/hash核验，14:46:27.857Z用时20.132ms，errors=[]；管理14:47:08.816Z收窄v3回原四scope。0产品import/types/install/build/PG/Chrome/provider。X01先行小运行窗口，后续需其结束回执与fresh资源准入；不自行轮询或开跑。详见[README](../../docs/evidence/wpf-release03/README.md)。

## A-only 后继裁决

本次先固定 history-only 入口供独审，仍无运行授权。两项exact362 HTTP attachment-only/mixed都保原始结果，任一失败禁止启动Chrome；A全绿但B未准入则封存，不能发布或后台续跑。180秒累计/8MiB/单专库/0provider不变。先前f333是原全矩阵准备checkpoint，无执行结果；新target以本段提交记录为准。

## 单次定向类型检查

2026-10-06 14:58:51.441Z 起，本人fresh核v3四scope/source997d与clean后，Node24/TS5.9.3实际执行两个显式入口的strict+noUncheckedIndexedAccess noEmit，exit0/1,839.676ms/log0B，自身PGID退出，0产品执行/PG/Chrome。原命令、全机free观察和停止条件保留在[typecheck-result](../../docs/evidence/wpf-release03/typecheck-result.json)，日志原样保留。20秒获准上限未扩大，不重复绿色检查。180秒业务矩阵仍0使用。

## A-only资源小delta

原997d经panels只读A-only guard-source批准（由root传达），不等业务兼容批准。后继按root授权调整history 32/16MiB附加余量、单次60秒含20秒清理；full保128/64。监视移至business import/CREATE前，关键await后stop/deadline/fresh资源核，未知CREATE/marker缺失仍不Force清库。原997d noEmit1.84秒保留为原检查，不伪称新delta重跑。该段编辑时业务0启动、B=NOT_RUN，等待小审和manager fresh准入；后续事实如下。Recovery direct已结束仅按管理消息归因，不复用任何旧free。

## 2026-10-06 15:07 UTC 源码批准与未运行

root于15:06:08Z独立只读批准432b的A-only资源delta，0blocking；该结论仅允许通过后续fresh准入的一次history运行，不是业务/兼容/发布通过，见[原样审查](../../docs/evidence/wpf-release03/source-review-432b.json)。

manager于15:07:01Z一次实测free1,058,885,632B，低于启动1,107,296,256B，也低于1GiB。原四scope v3/source/17只读依赖通过，但没有生成gate，PG/HTTP/Chrome/B均NOT_RUN，业务累计仍0/180秒；[原样准入](../../docs/evidence/wpf-release03/history-admission-not-run.json)。这是共享磁盘观察，不归因本任务。运行窗口由管理立即交回Lead；本人不重采、不重试，保持两脚本固定，待新明确资源准入。

## 2026-10-06 15:29:28 UTC 唯一 A-only 实际结果

15:27:29管理fresh准入通过；本人live核v3原4scope与两源码432b/clean后，仅执行history模式一次。15:27:55.348Z开始、15:27:59.219Z清理结束，runner exit1，累计3,874/180,000ms，剩余176,126ms。attachment-only原生context-observation POST实际HTTP500、history.latest=null；mixed实际accepted1但materials仍known且仅知识sources，附件遗漏，与已知362缺口一致。两项分别保留原始context/history/wire，非资源未准入，非前端App红。

[结果与原样hash](../../docs/evidence/wpf-release03/history-result-152729.json)、[history raw](../../docs/evidence/wpf-release03/runs/history-20261006-152729-727a99/history.json)、[wire raw](../../docs/evidence/wpf-release03/runs/history-20261006-152729-727a99/wire.json)、[cleanup](../../docs/evidence/wpf-release03/runs/history-20261006-152729-727a99/cleanup.json)、[budget](../../docs/evidence/wpf-release03/runs/history-20261006-152729-727a99/budget.json)。专库marker确认后删除，唯一worker PID381 exit0，cleanup/errors=[]，supervisor exit1来自业务断言。B/Chrome NOT_RUN，compatibilityId=null，未生成/导入SVC全绿报告，0provider。窗口已交回；脚本及固定产物不改，不重试。仅原后台owner处理最小修复，后续必须固定新输入/准入。全机minimumFree1,103,908,864B与freeAtEnd1,102,282,752B只作共享观察，不归因本次物理写入。

root已只读独立核10份raw共80,470B，见[原样结果审计](../../docs/evidence/wpf-release03/history-root-review-1527.json)；Lead已接收兼容失败与清理事实。此不构成完整兼容批准。新的最小后端组合由原owner固定提供，不在本树自行覆盖共享源码。

## 2026-10-06 15:34:33 UTC 后继后端输入安全点

原362负兼容记录676f已normalpush/local=remote/clean。只在两脚本增加显式准入的后端realpath/HEAD/tree及真实factory加载，固定dbaa88fa7a5adf1da077be7739842b6e42664c26；[接口](../../docs/evidence/wpf-release03/backend-input-interface.md)、[静态审计](../../docs/evidence/wpf-release03/backend-rebind-static-audit.json)。原断言/资源/累计计数不改；新目标未types/业务运行/PG/Chrome，实际候选由Lead受控交接。当前history/all并无独立B-only入口，不把all重跑A冒称只跑B。
