# F01 独立审查

状态：NOT_STARTED，模板不表示批准。

目标：待实现提交；base873738d9eb998c10bc71721d9b325fcc76ecd7b5。范围：共享contracts/client、center入口/usage、runner共享outbox/heartbeat与CLI，实际实现target提交后固定。

先核对实际worktree/branch/base/head/dirty，读取plan/status与证据；只读审查公共契约兼容、拒绝未知usage来源、task配置、续接序号、租期时钟边界和领域注册。已执行/未执行检查分别记录，缺少真实消费者不可只靠类型通过。

| finding | severity | blocking | target/证据 | owner回应/修复commit | 复审 |
| --- | --- | --- | --- | --- | --- |
| 待审 | — | — | 未开始 | — | — |

可复制审查任务：在上述指定worktree核对当前具体commit，读本plan/status/review，依据F01四项验收做只读检查；报告具体target、已跑/未跑检查、证据、severity与blocking结论，不沿用旧main approval。Claude Code或其他agent可只读；修复由符合Sol门槛的owner在独立worktree进行。
