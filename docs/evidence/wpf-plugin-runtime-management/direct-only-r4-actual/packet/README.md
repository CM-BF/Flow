# Plugin direct-only r4 — SOURCE_PREPARED / NOT_RUN

复用原第三调用器及已接受的最小修复设计，未创建通用监督框架。产品固定 6544；strict 已过不重跑。旧 30082/30000 FAILED、51 原件和 15 JSON 部分证据不改、不借额度。未来独立 direct-only 提案 20000ms 总额，15000work+5000cleanup；TMP8MiB、所有新保留文件1MiB（包含 prepared、raw、terminal 与外层64KiB预留），0网络/PG/Chrome/provider。旧原件留存另列一次，组合free不得把旧KEEP忽略。

## 最小修复

一次目录遍历按 prepared/scratch/raw/terminal 互斥计量，prepared 字节不再重复扣减。新 direct.json 最坏256KiB、terminal128KiB、outer64KiB先保留，effective stream allowance≤0在mkdir/Popen前拒绝。所有声明输出/consumed/scratch预存在时保留并拒运行；单次标记 exclusive创建。新 scratch 必须本次创建且dev/ino相同、全部owned PID/PGID确证ABSENT、计量非UNKNOWN才能删除。

EPERM及信号错误各自入FAIL；仍继续有界wait、双流drain、PID/PGID观察。raw cap只统计丢弃并FAIL，不中断cleanup读取。post-reap/delete前、写完result/budget后及terminal写后均核资源；未授权运行，所以此处是源码能力而非实际清理结论。

明确较早completion边界：work/cleanup结束恢复signal handlers，再写sealed结果。不是承诺through-OS-exit；接收必须 actual outer exit0、唯一完整stdout terminal逐字匹配disk terminal、result/budget/direct hash、exact15/1file/0skip-todo-fail、childexit0、双EOF/drop0、known cleanup和最大真实耗时。后续默认信号终止/外层丢字节不因diskPASSED被接收。外层捕获最多64KiB且须独立实测exit/EOF/耗时；如不足则FAIL，不追加额度。

## 静态检查与限制

仅Python AST文本解析、15名称展开、530既有只读pin字节核对；没有执行调用器、导入产品、noEmit/Vitest、网络或空间采样。完整diff见repair.diff，恢复草稿增量见resume.diff；原草稿在外部preserved目录，未覆盖历史。绑定state PREPARED_NOT_RUN拒绝启动，无gate。先独审本精确parent/config；未来manager授权后仅routine head/live/admission变化，产品及依赖变动须如实停止。

未来唯一命令：`python3 /private/tmp/plugin-direct-r4/run.py /private/tmp/plugin-direct-r4`。目前执行会因PREPARED状态拒绝；不得自行promote。最终HEAD与pins见binding/manifest，旧STOP-DRAFT仅历史。

最终 metadata HEAD：`61a7ac957a683f714b446d19aa090e32aafbe8be`；state仍PREPARED_NOT_RUN，原state/head版本保存在 `/private/tmp/plugin-direct-r4-before-final-head-20261007`。
