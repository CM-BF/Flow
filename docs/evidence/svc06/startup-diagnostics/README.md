# SVC06 启动诊断：限定局部片段

原宿主 r1 的 `START_UNCONFIRMED_CHECK_STATUS` 与清理事实保持；native 已限定批准证据忠实性，Lead 已收 main8c2ae379。本改动不将失败解释成 artifact/SDK 加载故障，不补造遗失 stderr，也不重用旧 r1。

## 实现与边界

精确前像 b2b，供给记录见 source-provision.json；初版 source953ce4d1，最后受控 spawn error 小修 source3cb0be8f57467a0ed4703119e68a96cd8f8e560e。实际产品只有 preview、其直接专测和新 diagnostics Module/专测四文件；原 process.mjs/test.mjs 没有行为更改。

- 父启动链先保存首次受控 role/phase/code，再执行原 owned cleanup；secondary cleanup/保存错误不覆盖 primary。公开 status 只多受控四字段，不输出任意 error 对象。
- runService 通过配置和 nonce 后记录 marker/policy/runtime/child-spawn/running/exit。配置 load 前仍可能无阶段，不将缺阶段误说成没启动。原参数、detach、nonce、ready 10秒、TERM 身份判定保留。
- 原真实 child stderr 进入每 role/nonce 独占0600文件，最多64KiB，达到上限仍 drain；写入错误也不停止子进程。记录不含任意 argv/env/message。真实非零退出、spawn error、安全诊断错误分别保存。stdout仍ignore。
- child exit 后 pipe 在100ms内无EOF则complete=false；此时仅关闭本观察pipe，不扩大信号权，不宣称内容完整。phase JSON fsync/dirsync并绑定当前nonce；旧代原件无自动回收。
- 新模块加入现有Web/maintenance工具精确字节资格集合；configured宿主不能只更换preview而漏验直接依赖。不是新cap框架。

## 实际局部验证

唯一结构化记录 local-runs.json，raw原样分轮。初轮12新诊断+2原process，第二轮新工具资格拒绝+3受影响SVC09消费者，14/14+4/4；preview syntax0、status parser errors/humanMissing=[]。历史任务开工 UNKNOWN 提示保留。追加1个真实spawn-error反例只定向复验它和2个受影响child观察例，3/3，结果见同一记录，不重跑18。合计19 distinct /21选择分轮，5组absent/双EOF及5exact scratch removed，累计2777ms/raw4252B。

所有fixture为自有临时文件/子进程；无PG连接、真实host、provider、个人目录、安装或build。Web资格的合成报告只证明loader/拒绝分支，不证明真实App兼容。单段预算180s累计/16MiB tmp/2MiB raw，27+.5+2秒每命令，fresh2.5GiB+18MiB；实际时间、选择数、组/EOF和exact scratch终态以local-runs为准。tmp是按fixture量级设计界限及收尾空目录核验，未做原子live峰值测量，不冒物理占用保证。

## 工程复核

沿已安装 find-skills / brainstorming / codebase-design / clean-code 方法，使用 Lead 已接受的小 Interface。私有材料职责独立，process 仍唯一持有停止身份规则；没有复制维护FSM/监督循环、没有spawn替换。受控错误码固定枚举，public输出白名单；文件检查含BigInt dev/ino、uid、nlink、nofollow、mode、字节界。局部补保 spawn code 是实现收口发现，旧raw不覆盖。

新artifact/真实host/迁移/策略旅程仍待重新固定输入、独立审查和实际共享窗口；本片不证明旧 r1 成功或个人可发布。03/04/05整体未勾完。
