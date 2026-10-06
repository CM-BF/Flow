# D05 检查记录

固定架构依据 main3773db5；只读数据不是自动拓扑。find-skills已选本地frontend-design/codebase-design/clean-code/brainstorming/webapp-testing；沿用中性tokens、原生SVG与固定数据，无新增依赖或任意文件endpoint。用户直接授权实施且Goal Owner给五视图验收内容，不重复技能审批。

局部Node检查2/2：45节点实际源码均存在于固定commit、节点边引用有效/图内边界；静态资源仅GET/loopback、原CSP、未知source endpoint 404。无产品全库/模型检查。真实CUA五视图、节点/键盘、zoom/fit、进度刷新后阅读状态、980浅色/390深色与标签测量见browser-checks.json。明确ready节点，不等networkidle。

视觉初版发现小屏fit文字过小，改默认100%图内滚动，<=1100说明下置；用户fit仍可选。五处英文标签越界改短中文+说明；实际DOM测量全部无越界。数据dashboard→ledger和运行center→PG、长依赖边采用少量显式侧绕，避免穿节点误示串联；不写通用布局引擎。中心独立verification修正至正确边界，Runner请求方向与C02终态依据源码明确；FSM主要路径旁列完整有效转换条件，避免用简图隐去有效完成/失联路径。

clean-code工作段/合并前：架构数据、SVG交互、原进度聚合各自职责；安全文本用textContent、固定源码链接；状态刷新不销毁架构组件，无模型摘要/新状态账本。UI边只描述功能关系，编译依赖用虚线；数据图不声称完整FK图。X01管理/O01编排/WPF-I01挂载均未冒充基线已完成。图后续需结构变化交付者同步或登记差距。

## 检查证据纠正

初稿local-checks.txt实际是1pass/1fail，作者未正确检查前一步exit code，随后git diff --check为0导致错误汇报2/2。失败原文原样保留于local-checks.txt与initial-host-negative-failure.txt，绝不替换为绿。Host负例用fetch传Host时观察到200，未额外捕获请求头，不能据此断言传输内部原因；改用node:http显式Host负例，产品服务代码未改。最终以set -e执行同两项，local-checks-final.txt记录2/2、fail0；post/Host/CSP/任意source404仍保持原要求。初步2/2口头与早期文字不能作为通过证据，独立review以修复后的固定target及final输出为准。

2026-10-06 03:29 UTC：合并前clean-code复核已审数据/交互边界，新增仅owner registry与审批metadata；无新增依赖或产品语义变化。Root批准cad1251；保留初始失败与最终绿色输出。

后续registry维护：新增真实已领取且canonical status存在的B01/X02/WPF-PERF02/CHAT02，精确owner树只读登记。架构仍固定3773；main4e817后的O01、WPF-I01/R03结构增量待本owner刷新基线，不把图的历史基线当实时main。

2026-10-06 03:58 UTC registry metadata：CHAT03与P03已原子领取、各自真实三件套存在，登记唯一status与精确WT/branch，41源验证合法/无重复。仅登记，不继承实现approval；不跑产品测试。架构仍明确3773固定基线，当前CHAT/X02结构变化待本批主线固定后刷新，旧图不冒充新增能力。

03:59同批补登记R04：claim1714e82b v1、真实canonical三件套已存在；42源合法，仍只有owner status为进度源。
