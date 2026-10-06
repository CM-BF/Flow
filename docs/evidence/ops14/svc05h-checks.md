# SVC05H 直接消费者验证

source 12c60bfcb3b434b3f3eeb54c581e60c05b21bfd2，2026-10-06 22:00:26 UTC。实际两个原用例均通过（2/2，0未选），exit0，外层410ms / unittest348ms，合并原始输出1137B。fresh free1,158,938,624B >=1GiB+4MiB；0私有临时文件，-B无bytecode。

阻塞写 operator 90000 在317ms被本监督仅PID SIGKILL，最早DEADLINE_EXCEEDED，后续退出非零保持独立；报告child absent/pipe EOF。独立stand-in90011在监督返回后仍存活，由测试finally TERM，原输出确认group absent。正常例同时证明旧分流输出。未执行实际operator/授权/个人服务/PG/Chrome/provider。共享模块3源相对afd01a原样，原模块15 different分轮未重跑；这次两个是不同真实wrapper直接消费者，单列，不冒一轮17/17。

2026-10-06 22:01 UTC clean-code / codebase-design 安全点：删除旧communicate/timeout循环，以固定相对路径导入共享模块，薄映射保legacy字段。信号、deadline、EOF和cap没有第二套状态机；DB/来源/许可仍caller责任。独立review待执行，SVC07尚未迁移，完整OPS14仍open。
