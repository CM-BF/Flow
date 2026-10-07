# O16 失败可观测性与私有声明局部结果

固定实验源码 `ff266d1ddc3adf3f89012095b4ff446367c3fb7e`，只调用注入 query、纯计量依赖及一个自有短 Node 子进程。7 个新不同用例分两轮通过；没有第二次 SDK/native/auth/provider/PG 运行。原真实 planner 失败及 DB/tmp KEEP 不变。

- run-01 实际 5 新例通过，query-run.test 文件加载失败（继承契约的 .js→.ts 解析缺少原 tsx loader），2 新例尚未收集。Node 报 6 tests 中的 1 是文件失败，不记为第 6 个行为检查。
- run-02 仅修 caller 加回原 tsx loader，选择该文件的 2 新例，2/2。前 5 不复跑。实验产品/测试字节仍为 ff266。
- 两 child 共 695ms，caller 共 717ms，原始输出 2525B。两个组最终 absent、双 EOF、自有目录均正常清理；原 EPERM 中间观察保留，不改成从未 unknown。
- 已验证 early-init 拒绝仍持久实际 SDK 入口 consumed1；缺 worker unknown；final resources 缺件/错源/缺目录 unknown；真实已存目录可在 stage cleanup 失败后被测量；受控 limit/I/O 字段与最早失败、checkpoint unknown 分开。
- 仅本次注入与局部边界通过，未证明新名单能完成真实规划、供应商 actual 模型资格、usage/cost 或全部 writer 终止。真实预算已消费，下一 query 必须新 GO 授权。

原始输出只在本目录两 run 下保留一份；继承源码/历史原件使用原 Git ref/path/hash，未复制 289 输入或改冻结包。运行器由已审环境 run.py 窄适配，OPS14 模块无改动。首轮文件解析失败与所有既有失败均保留。
