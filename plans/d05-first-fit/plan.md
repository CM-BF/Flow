# D05FIT01 · 架构图首次适配

状态：in-progress。owner d01_owner / gpt-6-astra ultra。2026-10-06 08:42 UTC。沿D05已有首次画布观察，原D06固定图保持不变。

输入固定main `7106a35447bf43026ad7b5ad7c25dc530fd0c4f5`。root已批准四literal：[status](status.md)所列renderer、专用browser test和本plan/evidence目录。唯一新树dashboard-architecture-first-fit / codex/dashboard-architecture-first-fit；旧D05/D06 source不迁移、不修改。

行为：五视图各自页内fit/manual状态，首次真实可见且可用宽度大于0才fit。保留42%～100%自动范围和40%～200%手动范围；390px允许画布局部滚动，不承诺将全部图压进屏幕。手动+/-后resize、tab返回、进度20秒刷新不重置；Fit显式恢复自适应。未访问视图首次fit，返回视图保留其mode/zoom。完整页面reload为新首屏，不添加持久设置。隐藏状态不以0宽初始化。

不改architecture-data.js/CSS/index/app/registry、旧D06资料；不重启4320/个人服务，不读真实模型/产品DB。

| TODO ID | 状态 | 说明 |
| --- | --- | --- |
| D05FIT01-01 | completed | 精确基线/独立tree/四scope committed take/技能与唯一source |
| D05FIT01-02 | in-progress | 局部缩放状态实现，保持用户选择及有界窄屏滚动 |
| D05FIT01-03 | pending | 独立动态fixture实际1280/390、隐藏/resize/刷新/五视图/键盘主题，固定源码绑定 |
| D05FIT01-04 | pending | root独立固定review、正常push、Lead集成后停写release |

验证只用本任务隔离HTTP静态fixture及现有浏览器运行时，不初始化协调/产品DB。先记录旧100%行为的失败，再验全部实际状态；sourcehash固定。展示相关断言以实际DOM/几何为准，不镜像私有函数。
