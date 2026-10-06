# OPS14 独立 review

状态：APPROVED；仅 Capture 增量（APPROVED_LIMITED_CAPTURE_INCREMENT），两真实 consumer 仍未迁移。
Review target commit：afd01a0387f8cc9d9797109be1fdead74606a4af
Base：c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05
Scope：tools/owned-process-supervision

审查任务：核固定 target / manifest / 当前字节，完整读取 Module 和行为测试。确认只 spawn 自有子进程、有限捕获与工作/停止期限、childPidOnly 不触 detached 用户服务、group unknown 不升级信号，最早错误与 cleanup 分离；调用方 persistence 不进入监督关键路径。核两调用形状及原日志，未迁移生产 consumer 不得称完整复用。review 默认只读，不重复已绿检查；finding 交唯一 owner 修复。

作者已执行：12 different 受控检查分轮（首 10/8、诊断 2/0、后 12/11、定向 1/1）及纯语法检查；详见证据。独立 reviewer 未执行；实际消费者迁移、PG / provider / 个人服务均未执行。无独审结论，空模板不表示通过。

追加限制：newChildSession 必须正 TERM grace，childPidOnly 仍可为零。独立 reviewer 源码预读指出 EPERM 直接测试需显式正 grace，已原断言保留调整。2 例最小选择待资源，原 21:33:44 gate NOT_RUN，不声明当前新增例通过。

## 唯一独立审查

Reviewer：assignment_review / gpt-6-astra，2026-10-06 21:35:48 UTC。完整原 3 源与最终 2 文件增量已读，原 26 / 最终 30 bindings 全同，无剩余 P1/P2；0 reviewer 测试 / PG / provider / 项目写入。[原报告](../../docs/evidence/ops14/independent-source-review.json)与[绑定](../../docs/evidence/ops14/independent-source-review-bindings.json)原样保存。

原 12 different 分轮证据保留；group grace 新反例与受影响 EPERM 用例因 fresh gate 未运行，不能报 13 passed / 2 passed。两真实包装器迁移继续未授权且未实施。只有追加原两例实际通过与必要独立核对后，才可请求模块完整接收。

## 21:40 参数检查追加（待独立核对）

在 Lead 新许可后只执行 policy-request 两例：2/2，11 未选，exit0 / 581ms，free 1,154,482,176 B；新例无 spawn，原 EPERM 例自有 child 97698 返回 unknown 后由测试 finally 收尾，随后只读 PID/group 均 absent。712B 原 stdout 含真实 ResourceWarning，未删；没有重跑历史12，没有PG/Chrome/provider。该事实补齐原源码批准的运行缺口，但不自行升级独立结论。

## 最终局部验证独审

assignment_review 原样[增量批准](../../docs/evidence/ops14/independent-validation-review.json)，SHA 21eaed7e69417712f278e0e0c4512e1f1b48e2ad53882302329e8e3f72723c9e；最终 source 3097730ee1abbb054c09ae2ed14c998ebde3ef49，新 9 bindings 全核，原两例真实通过 / 正常收尾。13 different 分轮，不是一轮 13/13；无剩余 P1/P2，reviewer 0 重跑。之前 SOURCE_LIMITED 与 NOT_RUN 历史不覆盖本次实际追加事实。真实两 consumer 未迁移，OPS14-04 仍 open。

主线模块接收：78fb37704d708e3b3b6ea4f1810947f012666196，3源与target3097730逐字相同。接收复用原局部检查，无重跑；两真实consumer仍未接入，完整OPS14未完成。

## Capture 增量审查入口

该增量仅 finite enum / Launch 默认 / 单 pipe stderr=STDOUT / Report.mode+实际EOF 与3个直接 consumer。原309 scope独审不覆盖此增量。新3/3、12未选，2新+1默认旧consumer；0PG/Chrome/provider，未重跑原13。核源差异、默认四项Launch兼容、内核单pipe捕获语义、同总cap、原最早错误与unknown逻辑未改、两实际wrapper无差。此增量仍未将两个wrapper接入。

Capture 唯一独审原样[报告](../../docs/evidence/ops14/independent-capture-review.json)/[绑定](../../docs/evidence/ops14/independent-capture-review-bindings.json)：完整3源delta与29bindings一致，无P1/P2，3/3原输出成立，reviewer0重跑；原309范围与raw保持。
