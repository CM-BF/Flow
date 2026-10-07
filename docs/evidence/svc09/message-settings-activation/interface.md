# SVC09A Interface

本片属于 FLOW-001/REQ19，消费 MATURE02 TODO08/11。固定基线 0da0dfcc68da42cc38d7c8e982f6b16321118391。实际个人 7d1/6c、旧 runner、Web d629-v3 仅历史输入，本段不读取或操作。

## 最小模块

`runner-slots.mjs` 拥有宿主槽位清单：默认 legacy 继续使用 config.runner、runner/、claude.json；显式 settings 独立 runner-settings/ 与不可变配置/runner 身份。只支持这两种槽，既有中心和唯一调度器不变。设置清单通过现有合同 codec 解析完整 choices，保留 model/thinking/effort/speed tuple，不做笛卡尔组合；access 固定 none。公布的 profile 必须绑定 runnerId/configDigest，真实目录确认与实际领取、账号资格分开。

显式设置入口受既有 operation.lock；登记前持久 intent，丢 runner 创建 ACK 保留 unknown，不能再次创建。旧槽及会话不迁移。槽位配置、manifest 和工作目录身份在启动前复核。新槽配置仅可首次建立，修改要求未来独立退役流程；本片不提供覆盖。

preview/环境/维护消费同一清单。start/status/stop 与 drain→hold→refresh→resume 覆盖全部已声明槽和实际记录；任一身份未知阻止重启/refresh。多槽维护沿既有 operation/version/CAS，不复制调度器；逐槽持久请求key与version，部分失败保留相同operation，不凭进程存在断言实际claim。诊断复用 role=runner，并限制 recordKey 只能 runner 或已声明 runner-settings。

## 资源、验证与限制

普通局部段累计≤240s、tmp≤32MiB、raw≤2MiB、同时≤4自有children，OPS14监督，0PG/Chrome/provider/个人配置I/O。直接例覆盖 legacy 不变、设置tuple、缺目录/错身份、丢ACK、全部槽维护与unknown。真实PG/个人激活/模型资格、混合队列端到端验收单列 NOT_RUN；核心混合队列由Mika拥有，当前片不更改该契约。

架构变化：宿主固定单runner→同一生命周期内有限二槽。架构登记待Execution Lead；无新runner pool/中心权限/执行loop。
