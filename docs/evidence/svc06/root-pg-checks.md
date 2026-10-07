# 根宿主 PostgreSQL 依赖闭包增量

source `893324703fe35c3b9fca1dbfbec96bdd6b4405fa`，base `82bebb856d1bdaca5bf5b9836491ef553f67df53`。独审待Execution Lead；完整产物未运行。

固定8c的 `preview.mjs:9` 与 `maintenance-host.mjs:6` 在根 tools 目录静态导入 `pg`。`apps/server` 的依赖安装位置不能给这些祖先目录解析提供保证。因此在同一个私有来源表增加根manifest/lock声明的pg8.23.1；仍仅提升tsx、pg、固定Web Vite，不提升其他dev依赖、不装Web workspace、不改manifest/lock源字节。原恢复seam检查安装投影后还原根字节。

新增root pg断言先1 red；修正后新断言、已有选择投影和staging直接消费者3/3，3 distinct。固定8c锁另一次纯选择exit0：7 importers/271 snapshots/packages未增，pg已在server闭包内；此变化是根解析入口，不是新增包/物理节省。原8 distinct与parser7不重跑，原红保留。

本段3轮OPS14累计677ms / 120s，raw9028B / 128KiB；每轮最大30s、fresh≥2.5GiB、tmp≤16MiB/live1GiB。3组absent、完整EOF、tmp均empty且同dev/ino后正常删除；20ms观察不是原子峰值或预留。实际时间、源绑定与采样见[run](root-pg-validation/run.json)。0安装/fullbuild/PG/Chrome/provider/个人操作。

固定来源实际pg版本8.23.1与原root锁一致；最后artifact import清单必须包含tools/preview及maintenance-host，以及server/runner/SDK/Vite，只import不调用工厂。完整运行输入必须为包含本修复的已审一致main；旧8c缓存只读原件保留，不能将该旧输入声称已覆盖新实现。

本段本地skills方法：find-skills优先现有安装；codebase-design沿同来源表/原投影模块，不造角色分支；clean-code 2026-10-07 03:22:06 UTC核命名、单一职责、错误与还原，发现无需新抽象。路径 `/Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,brainstorming}/SKILL.md`，沿既有版本，不安装更新。
