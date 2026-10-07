# X01 Stage A 独立后继 local 段

本段当前 **NOT_OPEN / NOT_RUN**。产品仍为 ade4efa0a332f4f1f1cbcd50012ab8881f41a8dc；不重跑旧65或七组内存Report回归。新source只改三个路径字面：caller/同PID launcher使用`enable-binding-stage-a-run-r2`，caller读取[小输入](enable-binding-stage-a-input-r2.json)。它只投影原manifest的6个support/3个external绑定并更新两Python源；原50TS/产品15/config/7link请求不复制、不改变。原d6 manifest、91f86 HOLD和已消费`enable-binding-local-run`逐字保留。

沿main73717adb2a8e237e980e4346629fd4fa869e7a6c的`docs/quality/local-validation.md#bounded-local-iteration`：一次有界local段内按原strict→Vitest顺序执行，不为两个命令分别申请许可；复用现OPS14与原单结构化收据，不增加wrapper或监督循环。既有`--mika-approved-once`及独立claim receipt仍是整个30秒段的准入实现，不复活旧OPEN。若需要修后复测，必须保持失败原件、使用新的排他namespace，并服从co-lead给该工作段的总预算；本准备没有循环、重试或后续阶段授权。

执行入口（在本WT，HEAD为包含此输入的最终clean packet；两个大写占位由实际co-lead准入替换）：

```text
/opt/homebrew/bin/python3 -B docs/evidence/x01/enable-binding-check-once.py --mika-approved-once REVIEWED_PACKET_HEAD ABSOLUTE_ADMISSION_PATH ADMISSION_SHA256
```

原receipt要求`kind=X01_LOCAL_CHECK_OPEN`、`state=OPEN`、`lead=mika`、32位hex `windowId`、完整`reviewedHead`及`ledgerObservedAt`不未来且≤60秒，claim身份和17项有序scope逐项同v8收据。caller另核全部固定输入、工具/7link与完整Git clean/branch/HEAD，再排他消费新目录。历史Darwin observation不单独决定失败；最终ownership、监督错误、signal unknown、EOF/捕获、checkpoint与持久化未知仍阻止后继并保留资源身份。

真实命令仍是原TypeScript `--noEmit -p enable-binding-validation-tsconfig.json`，随后Vitest只选contracts/plugin-runtime与runner/plugins/execution两文件。**17只是计划数**（合同6+runner11），后者真实打包11次并import自有包，不称纯fake；实际选择数与退出由原receipt确认。boolean/integer/enum实际字符串传包的直接断言尚不足，本段不以prefix成功扩称这三种适配已验。

预算保持：内部30秒包含准备/两命令/收束，strict最多8秒、tests最多14秒，OPS14额外TERM/KILL各0.25/0.75秒计入余量；最终报告fsync与CLI退出仍需外部实际时钟单列，不冒称模块硬保证。raw总512KiB，其中streams448KiB、tail64KiB，CLI8KiB已在tail预留，不能再加一遍；TMP结束采样≤32MiB/4096节点，不宣称硬峰值。原free floor1107296256B；如Web ACCESS重窗口并行，co-lead准入须另计它的256MiB TMP+8MiB raw与本次512KiB raw/准入余量，不能拿旧磁盘观察替fresh。0PG/HTTP listener/Chrome/provider/安装，无共享可写产品或端点；donor只读。

2026-10-07T03:11:58.466Z fresh ledger确认v8 ACTIVE17且同身份；准备前e484a6d clean。同日03:11:53 UTC，chatui01_owner对e484的七组结果作RESULT_FIDELITY_REVIEW_APPROVED/0P1P2：1232B完整raw、7/7/exit0、最终absent，仅一个受监督Python进程，测试内0child/TMP。不同时间口径分别保存，未推定完整外部wall。该结论只解除caller消费缺陷，不是本Stage A通过。

方法：本地find-skills→codebase-design/固定sickn33 clean-code；复用既有Interface，只有固定路径和输入投影改变，未知/失败/清理职责与原命令不改。只作Git/文件审阅与绑定，未导入、语法执行、typecheck、collect、测试或tar。产品与数据库架构无变化；支持源增量仍待固定target只读独审。
