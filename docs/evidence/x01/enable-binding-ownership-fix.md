# X01 OPS14 Report 消费窄修（NOT_RUN / NOT_OPEN）

产品 ade4 与 shared supervisor 均冻结。本片只修调用方把历史 observations 中任一 unknown 永久升级的错误；依据 OPS14 固定 Interface `715525e4d1510b89be7e71a236d537b1f2953038` 与限定验证结果 `0720625cd88ff7bfb8c1830eede8b8bfa91ded7e`。`supervise.py` 12543 B / SHA256 `725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d` 未变。4/4 是 OPS14 自有证据，不计为 X01 检查。

调用方仍同时检查最终 owned_state、exit、EOF、observed/retained、first/secondary failure 和 signal unknown。只将 observations 从失败集合移除，原历史记录逐项保留。最终 unknown/present、任何监督失败或 signal unknown、capture 不完整继续阻止后继并保持报告 unknown；非零业务 exit 可有完整 raw，但仍由原主流程拒绝业务通过。持久化/checkpoint/TMP 身份 unknown 的原粘住规则不变。

`supervision_facts` 是原报告判定的小型纯函数提取；主流程复用它，不增加 supervisor、重查组或平台特例。新 `enable-binding-ownership.test.py` 只使用共享公开 Report 构造内存记录，再调用该函数；固定 hash 后 inert 导入两源，0 subprocess/PG/tar/listener/产品导入。七组计划断言：历史 unknown→最终 absent 且无失败、最终 unknown/present、首监督失败、业务首失败叠加 cleanup 失败、signal unknown、无exit/无EOF/截断、业务非零但 raw 完整。参数化子项不叠加为更多独立 test。

最小验证请求（尚未执行）：固定 Python 3.13.3，`-B docs/evidence/x01/enable-binding-ownership.test.py`，单次≤5s、合计 stdout/stderr ≤8KiB、0新子进程/临时根；由 Lead 准入后使用现 OPS14 有界调用，报告持久化与工具退出另外诚实记录。不运行 Stage A 的 strict/Vitest/11tar，不复跑 OPS14 四项真实进程回归。当前无局部槽或新 OPEN；红/绿均 NOT_RUN，未声称 TDD 实测。

原 Stage A HOLD 固定结果91f86、manifest、d54依赖收据与 `enable-binding-local-run` 全部保留。原 caller manifest仍绑定d6历史；本增量另有固定manifest，**不将此源码包当下一 Stage A 可执行包**：旧run已占用，新运行namespace/manifest和新fresh OPEN仍须后续明确准备/审查，本轮不换路径、不重试。shared/header/runtime/034等所有产品源不改。

方法：沿既有 find-skills，本地 brainstorming 的 bounded 路径使用本次已授权具体修法；codebase-design 将报告判定留在 caller seam，clean-code 固定 sickn33 基线核错误身份、命名和单一职责；TDD 只准备行为反例，遵守本轮禁止执行。没有技能或依赖安装。
