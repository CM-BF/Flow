# B02 技能与质量

2026-10-06 04:43:45 UTC：Node/TypeScript、PG/HTTP有界测量。按本地find-skills方法读取 /Users/citrine/.agents/skills/find-skills/SKILL.md、codebase-design/SKILL.md、clean-code/SKILL.md。clean-code来源沿sickn33固定bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重装。应用：HTTP seam测真实消费者路径，分开数据量/查询数/耗时，instrumentation不改变业务判断；fixture生命周期先finally，只清自有资源；不制造猜测优化或删digest。

2026-10-06 04:48 UTC：交付前夹具检查。保持业务源码原样，通过动态import之前安装的pg/crypto观察器计数；包装保留原返回值/错误与callback/Promise形态。finally恢复prototype/builtin，关闭server/pool后仅正常DROP自有DB。发现并修复继承根exclude导致0输入(TS18003)、hash包装this缺显式类型(TS2683)，两份失败日志保留；最终noEmit实际exit0见typecheck-result.json。此刻未运行HTTP基线。
