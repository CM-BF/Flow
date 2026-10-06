# WPF-WORKSPACEPERF01 Review

**状态：NOT_STARTED**

Review target commit：1711e2b0933ec28b8bbd9af11cba4243b644e0d7

Base：c450c2da7e6185b88db9f46e0299ee504ee6f3e8。仅两个新专测，四claim scopes见status。

审查核真实HEAD/dirty与source/dependency hash、90秒/8MiB预算执行与cleanup、实际UI交互而非私有对象、迟到与新read分别、草稿/知识/unknown保存及原key重试。JS私有缓存/heap未测不得猜值，partial不得伪称通过全部矩阵。只读review结论给owner记录，修复由owner完成；不要写旧fixture或作者原证据。当前无独立检查，模板不代表批准。

作者限定交付：8个行为段通过、末尾截图导航失败，browser partial/exit1；两入口定向types通过，全Web两处既有错误。检查不得改写成全绿。固定两源hash/180依赖证据见 [checks](../../docs/evidence/wpf-workspace-lifecycle-baseline/checks.json)；执行HEAD313f+dirty与最终目标分别保留。没有新preview，实验own服务已清理，独审优先读取原始JSON与源码，额外运行须另有预算。当前候选保留末尾导航已知限制，不将缺图当产品问题。
