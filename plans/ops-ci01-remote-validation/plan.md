# OPS-CI01：远程零模型验证候选

状态：accepted。所属大task：[OPS-001](../../../plan-status-review/plans/ops-001-status-review/plan.md)。co-lead：Execution Lead。

在现有停用 CI 模板内形成一个小而可审的 Ubuntu 合同与公开 handler/PG job，修正数据库变量与名称，明确退出、选择和清理事实。当前只交文档候选，用户最终启用另行执行。

职责/输入/输出/错误与资源边界见 [Interface](../../docs/evidence/ops-ci01/interface.md)。只复用原 Vitest 和 C01 fixture，不新建测试框架、调度器或模型授权。基线 37f75d3654fc500d37b1ddfda0871807d878715f，独立 codex/ops-remote-validation。

- [x] OPS-CI01-01：核原模板/真实入口、领取四 scope、冻结短 Interface。
- [x] OPS-CI01-02：修订两个 CI 文档与有限静态验收证据。
- [x] OPS-CI01-03：固定 target/manifest，独立 review 后受控接收。
- [ ] OPS-CI01-04：用户最终启用与一次远程真实运行；本片不执行。

实现 scope：docs/ci/README.md、docs/ci/check-workflow.yml；自身 plan/evidence 为管理范围。0 本机依赖安装、产品测试、PG、浏览器、provider。静态检查不等 Linux 运行通过。

准备片 main 接收：`decab94f20bc5345cb74fe82eb9b93b6e135c333`，两文档与独审目标逐字相同。OPS-CI01-04 保持 open；远程 NOT_ENABLED / NOT_RUN。
