# S01P04 直接消费者修复自查

2026-10-06 11:28 UTC；status_read / gpt-6-astra。本地 find-skills / clean-code / codebase-design / tdd 来源与 SHA 沿用 skills.json，无新安装。修复遵循 Mika 已批准的小范围，不新增模块或生产锁模式参数。

chatui01_owner 的 2026-10-06 11:24:47 UTC 独审为 e184 固定实现指出唯一 P2：steering 同 task 的 final/command 交错测试仍等待 runner FOR UPDATE。v3 COMMITTED 后只改该消费者文件及本证据/状态，production runners 和新9项PG源码保持 e184，48旧 manifest 项均逐字冻结。

等待谓词改为 loadTask 的精确 SQL，并要求当前 final 持锁连接 PID 出现在实际 waiter 的 pg_blocking_pids。真实请求必须先阻塞，再等待同事务 final commit 后返回409；额外检查 sealed=true 且 commands为空。pending promise立即装 rejection handler，并在finally中先rollback/release再await收束，失败不留下悬挂请求。最多100轮/10ms，连接与query有显式超时；不改变生产 fence、不删除旧竞态断言、不用时间sleep推断已阻塞。

沿用此消费者的随机专库和动态HTTP端口；fixture在CREATE发送前标记creationRequested，finally只查/删确切自有库并确认零连接、DROP后absent，失败报告唯一名称，未使用FORCE/kill/共享schema。请求已有5s timeout。纯测试默认synthetic descriptor会import现有SDK模块，无Query、adapter.run、auth或provider调用。

首次import缺本WT @flow/client导致0tests/exit1，strict缺固定SDK类型并发现QueryConfig不支持query_timeout，原raw完整保留。复用Git忽略目录内逐项symlink：client指本WT，SDK指既有0.3.290，无安装/lock变更。删除不合法QueryConfig选项，使用Pool级query_timeout；局部strict继承根全部strict/ES2023/noUnchecked/skipLibCheck，最终0。

实际仅一次进入PG fixture的定向检查：1通过/15未选；holder156359 / waiter156347，task锁正阻塞，专库flow_chat07_ba470e0a738e4f3e9d0fafb9ba6d67fb零连接且absent。原9PG+ENG1未重跑，新累计11不同通过不是一次11/11。未跑其余消费者、全库、capacity或provider；无新增生产语义。固定修复target后由原reviewer复审，尚不宣称APPROVED/main。
