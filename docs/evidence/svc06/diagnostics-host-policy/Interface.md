# SVC06：诊断产物隔离宿主后继

状态：准备/NOT_RUN；只在本SVC06 own records，个人安装与61227/61228不动。新artifact `7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920` / source `6c0fdcda8858aac33489c48c1948e902dd6a3d7e`；旧c2c/r1/所有失败原件保留，不重build/import。

唯一入口为本目录supervise.py→entry.mjs。原[r1 Interface](../b2b-host-policy/Interface.md)的一次顺序、af51真实公开fixture、27→35迁移、默认off/配置负例、同op维护刷新/恢复、HTTP断言与独立cleanup全部复用。`journey.mjs`和`work-terminal.mjs`从原固定方法逐字复制到本次私有run；entry唯一相对import重写使私有副本本地读取terminal。不改变真实spawn、ready10s、nonce/identity或TERM。新namespace `/private/tmp/flow-svc06-diagnostics-host-policy-20261007-r1`，旧r1不可重放。

新增只读观察Module `startup-observer.mjs`：work finally及独立cleanup确认所有已记录detached组stopped后各保存一次metadata；只从本root/state和三份本run generation取最多六个nonce，读对应私有诊断JSON≤4096B/stderr≤64KiB。root/run/诊断目录必须700/同uid/nofollow/realpath稳定；文件600/nlink1/同uid/regular、BigInt身份/mtime/长度前后稳定。public摘要只role/phase/受控code/at/exit及stderr bytes/hash/截断/EOF；不输出raw、配置、token、argv或env。stderr原件仍留原产品私有目录，未来诊断读取须脱敏。缺失、尚在runtime阶段或竞态记NOT_OBSERVED/unknown，不造数值exit。观察失败单列，绝不盖原primary或改变ready。

独立cleanup仍只用原stopOwnedProcess，DROP必须消费绑定本run/input的work终态且组absent；没有确认的writer即KEEP，即使瞬时零连接。新观察位于stop后、DROP前，但只提供证据，不替代nonce/marker/OID/有界零连接守卫。诊断错误不当成功，不延长原外层30s。

预算原封不动：work180+cleanup30，各.5TERM/2reap；fresh≥2.5GiB并叠加当时实际并发、live1GiB；artifact副本512MiB+私有64MiB+PG96MiB+raw2MiB=674MiB（原packet的newPhysicalPlanningBytes=674MiB、含raw总676MiB保守规划沿用，不以逻辑bytes冒物理）。最多六份64KiB输出已含私有64MiB，outer两段各128KiB capture。实际连接最多15配置：旧server8+boss3→正常close→新center8+boss3，同顺序不重叠；fixture1+maintenance2+helper1。fresh检查cluster余量，非峰值实测。

准备只做新增观察器3个tiny文件例+entry语法，10s总段/1MiB临时与raw保留在既有局部预算内，0PG/host/provider；不重跑原terminal3例、诊断19例或build/import。方法复用既有find-skills/codebase-design/clean-code基线；本leaf只观察，不复制产品诊断写入/监督/维护FSM。

loader v1/v2合成材料始终标NON_PRODUCTION_LOADER_FIXTURE，只证明加载/拒绝合同；真实HTTP、35迁移、旧代表数据与原配置保留单独断言。即使通过，也不证明真实三App兼容、个人可采用、第四Web可发布。
