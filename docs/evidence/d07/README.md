# D07 验证与限制

仅变更human阶段解析/筛选和局部测试；不改变状态事实源、review/main证明、进度TODO、领取或产品。Root明确阶段语义，find-skills本地brainstorming/codebase-design/clean-code/tdd已读并应用：parseStatus→humanOverview是行为Interface，用原文状态测试，不镜像实现算法。

初始red.txt：1/1预期失败，delivered且后继pending仍被选为下一交付。修复后green-final.txt为5/5；consumer-checks.txt为4/4原human消费者（按显式name选择，未跑含历史registry固定数量的无关测试）。未重跑产品/数据库/模型。

browser.json为Chrome154实际浏览器：先读取候选真实owner来源56条，CHAT02不在下一交付且其05 TODO仍pending；后用明确合成stage夹具确认review/integration可见、delivered在历史，390px无横向溢出/pageErrors空。两个截图均已实际查看，可读且无遮挡。夹具故意仅3task，无FLOW-001，显示“当前阶段待补”是真实缺省，不是生产总体阶段。browser-driver.txt保存执行脚本原文（临时路径，不新增产品脚本）；默认端口动态、退出只关闭自己的server/browser，未动4320或用户预览。

浏览器首次运行在开始前因错误的根playwright import路径ERR_MODULE_NOT_FOUND退出，未启动浏览器/server；改为已装pnpm中Playwright1.63.0精确路径后成功，未联网安装或改变依赖。现有Node24/pnpm9.15.4离线冻结安装仅准备worktree node_modules，lock无diff。

兼容：无新字段只标source=legacy，标准in-progress/blocked仍作为实施候选；completed/delivered仅legacy作者历史，不给review/main虚假approval。其他自由文案不猜；活跃owner应补显式review/integration。非法显式字段unknown不fallback。已集成target后来范围变化不重开该片段，原main/proof详情照常保留。真实阻塞先于优先级，再稳定ID排序，下一交付最多3条。

合并前clean-code：单纯派生函数，不复制状态或引入缓存；阶段枚举5项、原接口仅增加可选解析字段。没有新依赖/权限/数据库/模块边界，固定架构图无需修改。

组合接收补项：DPERF外部批准5cd7f00仅同一任务快照的相同target复用，未跨snapshot缓存。D07原子amend v2取得human-proof.test.mjs范围，6d08c30把固定28来源计数改为validateRegistry+ID唯一性，保留I02/WPF/D03路径断言。四个局部文件实际31/31，8.84s，原外部26项中固定计数失败保留在其证据，未删测试/跳过；本test-only delta待Root复审。
