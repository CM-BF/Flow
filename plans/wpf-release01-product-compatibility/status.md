# WPF-RELEASE01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-07T10:18:03.068392+00:00 |
| 所属大task | [WPF-MATURE-01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-01-visual/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | w01_owner / gpt-6-astra / ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-release-compatibility |
| Branch | codex/web-release-compatibility |
| 工作基线 / HEAD | 固定后继基线 41276e2ecd154087f66958339d9abfce4d44964c；不 reset/rebase |
| 工作树dirty状态 | 源码9658a6b763de69038778de1b0c16de64ff824c75已固定；本次metadata正常封存，提交后clean/remote回执另证 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | FAILED：f3d唯一strict exit2；9658 type-only修正NOT_RETESTED。browser/PG/真实compat NOT_RUN；历史7805不继承 |
| 已集成main状态 / HEAD | NOT_INTEGRATED 当前后继；历史7805于c450c2da7e6185b88db9f46e0299ee504ee6f3e8接收 |
| 实现目标 | 9658a6b763de69038778de1b0c16de64ff824c75 |
| 实现范围 | apps/web/test/web-release-compatibility.fixture.ts, apps/web/test/web-release-compatibility.browser.ts |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 固定地址验证入口已完成限定源码审查；已修正局部类型声明，等待相关复验 |
| 下一可用交付 | 完成必要类型复验；最终后台交付和受控调用器就绪后安排真实兼容验证 |
| 当前阻塞 | ACTIVE: 最终后台产物与公开会话策略配置尚待原发布负责人提供；不阻塞本段源码实施 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，f3d限定源码已审0blocking；9658类型修正NOT_RETESTED/待delta复审 |
| 开工 UTC | UNKNOWN |
| 完成 UTC | NOT_COMPLETED |
| 时间来源 | 历史完整任务开工未重建；本次后继实际开工 2026-10-07T10:01:18.415296+00:00，见 [segment-start](../../docs/evidence/wpf-release01/fixed-origin/segment-start.json) |
| 领取 | 新 claim38b9a7ff-c9be-4b56-af50-e076afb603bc v1 exact4 COMMITTED；旧20a6529a v2 released不复用 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| RELEASE01-01 | completed | w01_owner | [历史固定构建/清理](../../docs/evidence/wpf-release01/source-manifest.json) |
| RELEASE01-02 | completed | w01_owner | [历史两App真实兼容](../../docs/evidence/wpf-release01/README.md) |
| RELEASE01-03 | completed | w01_owner | [历史7805主线接收](../../docs/evidence/wpf-release01/main-source-observation.json) |
| RELEASE01-04 | completed | w01_owner | [固定origin设计及边界](../../docs/evidence/wpf-release01/fixed-origin/report.md)，[两harness固定实现](../../docs/evidence/wpf-release01/fixed-origin/source-manifest.json)，f3d源审0blocking，9658类型delta待核 |
| RELEASE01-05 | pending | w01_owner | 最终tuple、限定源码审与必要局部检查/三App真实四项兼容待完成；当前真实compat0actual，已有strict首红 |
| RELEASE01-06 | pending | w01_owner | 后继最终delta独审/主线接收；个人发布仍由原发布operator执行 |

## 结构化等待

| 开始 UTC | 结束 UTC | 原因 | Owner | 解除条件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| UNKNOWN | OPEN | 最终后台source/artifact及非敏感会话策略设置待供应 | 原发布负责人 | 收到已审immutable tuple与实际导入入口，明确policy hash一致 | [设计输入](../../docs/evidence/wpf-release01/fixed-origin/candidate-interface.json) |

## 边界与交接

仅当前原四scope唯一writer，其他Quick/DPERF/RELEASE03保持停止写入。不启动PG/Chrome/HTTP/build/install，不访问个人61228。61228只允许后继受控Chrome页面流量经精确代理；page.request/context.request/route.fetch/Node fetch不可用于该origin。三旧App原生Bearer与独立Cookie/CSRF补证分开，format1不补releaseId。

唯一status仍供原source登记读取；未自行请求dashboard服务。架构影响仅受控验证接口/owned proxy，不改产品或共享契约；最终固定target交co-lead独审后由原Lead判断是否更新固定架构视图。历史状态原件见[previous-status](../../docs/evidence/wpf-release01/fixed-origin/previous-status.md)。

## 2026-10-07 局部检查安全点

[唯一strict首红](../../docs/evidence/wpf-release01/fixed-origin/types-first/result.json)：父实际exit1、compiler exit2，stdout852B/双EOF/drop0，owned PGID16208和scratch已清；晚terminal1169.181ms按1170ms记账，原20s段CLOSED、未用18830ms不转credit。[f3d限定独审](../../docs/evidence/wpf-release01/fixed-origin/f3d-source-review.json)与9658 type-only修正分开；后者复用公共配置类型，不硬编码版本/不cast，尚未复验。已授权后继独立10s段按管理顺序在DPERF收口后再fresh，不自动运行。当前四scope停止写入，claim38b9v1保留；不等于释放。
