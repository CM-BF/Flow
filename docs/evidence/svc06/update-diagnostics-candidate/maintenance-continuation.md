# 已完成 R2 后只续接维护

原 R2 `0455baa30dab9676b1df807e4c643131cb965244` 已获 APPROVED_PARTIAL_ACTUAL_FIDELITY_NOT_BACKEND_UPDATE；见 [原样独审](partial-actual-independent-review.json)。迁入、Web-host replace、三报告和205B策略已消费。此入口没有任何 copy/rename/replace/import/policy-write 分支，保留全部原失败与原件。

## 固定调用消费者

[maintenance-continuation.json](maintenance-continuation.json) 是唯一参数表；[maintenance-continuation.py](maintenance-continuation.py) 按固定顺序调用现 OPS14，逐阶段持久原始 Report。没有新的服务管理/维护状态机。实际命令为固定 Python3.13 + `maintenance-continuation.py --execute-fixed-maintenance <Lead实际窗口ID>`；当前仅准备，真实执行须 Lead 已协调新窗口与 fresh claim/输入/资源事实。

顺序是 facts-before（原 helper 必带全新 absolute exclusive output）→只读 preflight→history-before→root公开 bootstrap→真实 operation 读取→产物公开 refresh→facts-paused/history-paused→持久保护 checkpoint→产物一次 resume→facts-final/final。维护三个命令的 Node / `--import tsx` / module / cwd / 四个位置参数均在参数表固定，实际 root入口仍同6c；产物入口只有真实 bootstrap 已建立 operation 后才调用。不经旧CLI选择，不预填 backendArtifact。每个事实文件都读完整持久内容，不拿 stdout 摘要当 facts。

12个调用均复用 OPS14 childPidOnly；detached三角色只由原公有工具操作。900秒共享工作截止从 bootstrap 调用前记录，不因 refresh/resume 重置；每次 work 使用总剩余额、保留2秒reap。持久化先于下一动作，若错误/unknown/期限不足立即 STOP_KEEP_NO_RETRY；若持久化本身未知，不推断任何阶段完成。普通旧角色就绪/停止界限不增，原>=2.5GiB fresh/live1GiB、新增512MiB/总raw2MiB保持，阶段 capture64KiB。迁入已占367,041,727逻辑B，后继无大copy，不将APFS clone节省当预算保证。临启动仍核当下其他并行声明和原最大15配置连接。

## 为什么增加旧列摘要

旧 facts 在 PostgreSQL 端对 `to_jsonb(t)` 的整行求摘要。27→35增量迁移会为旧表添加列；即使每个旧字段不变，整行摘要也会变化，不能据此证明旧数据未改，也不能把所有变化都归给迁移。[history-projection.mjs](history-projection.mjs) 因而冻结 before 的列名，after 只投影同一列集。SQL只返回 count、MD5聚合摘要；仅 migrations/runner_maintenance_audit 额外返回行摘要多重集，用于保原行同时允许准确的8个migration和2个维护audit新增。用户正文、token或配置值不出数据库。

普通旧表要求行数/旧列摘要完全相同；conversations只排原queue_checked_at。runners仅排公有维护代码本来修改的4个maintenance字段，并在独立事实门严格检查 accepting18→draining19→maintenance20→accepting21/真实operation。runner身份/token与其余字段仍在摘要内。进入 ready-paused 后所有旧行必须保留，原已排队任务不能被取消或清空；任何非约定变化停止，不自动resume/rollback。resume之后正常用户工作不被此operator暂停或回滚，最终报告区分维护前已证保留与随后观察。

R2首错是直接对 CommonJS pg/lib/index.js 使用命名导入Pool；ESM linker在入口正文求值前拒绝，因此原62ms失败为0 SQL/0个人读取。修复复用 facts 的 createRequire→require('pg').Pool，绑定根package.json锚及已审pg8.23.1。既有fixed runtime53pins与15包/978file、source-artifact manifest沿原inputs引用，不复制一套manifest。新增helper和参数仅有界差量绑定。

## 本轮零副作用检查

[history-projection-repair/](history-projection-repair/) 保89ms首轮CJS加载/空Pool构造与原raw；最终参数consumer31ms、实际Node/tsx root及自有原7d1产物维护模块导入487ms均通过，三个组absent/双EOF，762B raw、无tmp。Pool从未connect/query，未调用maintainPreview或snapshot，0个人读写/PG/HTTP/provider。SQL构造与错误标识、旧列变化拒绝在纯分支检查中覆盖；未冒真实投影SQL已执行。完整个人续接仍NOT_RUN。

## fresh剩余资格

精确R2保护事实、当前7d1库存fullverify、已替换7d1 Web-host、固定三份v2报告与策略完整pin必须仍一致；原后台af51/v18、runner与用户任务无新不安全变化才进入bootstrap。根入口53runtime沿原审核；目标产物逐manifest验证而非仅存在即通过。所有后继输出使用全新 personal-maintenance-r3，不能复用R1/R2或已消费维护步骤。最终实际操作前仍由Lead协调唯一共享窗口，不在此准备中读取个人现场。

质量安全点：仅修实际调用消费者与保留观察，复用公有维护FSM、原facts与OPS14；命名/单一职责/错误停止/有界输出已复核。第一轮89ms仅早期CJS解析差量（源hash在其invocation），最终helper由后续487ms实际入口导入检查覆盖；不将第一轮当最终完整快照SQL验证。真实SQL与剩余个人维护均未执行。
