# OPS14 独立 review

状态：NOT_STARTED
Review target commit：3097730ee1abbb054c09ae2ed14c998ebde3ef49
Base：c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05
Scope：tools/owned-process-supervision

审查任务：核固定 target / manifest / 当前字节，完整读取 Module 和行为测试。确认只 spawn 自有子进程、有限捕获与工作/停止期限、childPidOnly 不触 detached 用户服务、group unknown 不升级信号，最早错误与 cleanup 分离；调用方 persistence 不进入监督关键路径。核两调用形状及原日志，未迁移生产 consumer 不得称完整复用。review 默认只读，不重复已绿检查；finding 交唯一 owner 修复。

作者已执行：12 different 受控检查分轮（首 10/8、诊断 2/0、后 12/11、定向 1/1）及纯语法检查；详见证据。独立 reviewer 未执行；实际消费者迁移、PG / provider / 个人服务均未执行。无独审结论，空模板不表示通过。

追加限制：newChildSession 必须正 TERM grace，childPidOnly 仍可为零。独立 reviewer 源码预读指出 EPERM 直接测试需显式正 grace，已原断言保留调整。2 例最小选择待资源，原 21:33:44 gate NOT_RUN，不声明当前新增例通过。
