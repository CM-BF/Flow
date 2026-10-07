# SVC09A Interface

本片属于 FLOW-001/REQ19，消费 MATURE02 TODO08/11。固定源码基线 `0da0dfcc68da42cc38d7c8e982f6b16321118391`，实际个人 7d1/6c、旧 runner、Web d629-v3 仅历史输入，本段不读取或操作。唯一验收来源与已主线 CORE 资格接缝见 [deployment-inputs.json](deployment-inputs.json)。

## Module 与消费者

`runner-slots.mjs` 只拥有有限槽位配置和身份：默认 legacy 继续使用 config.runner、runner/、claude.json；显式 settings 使用独立 runner-settings/work、不可变 manifest、新 runnerId/token/configDigest。preview/环境/维护/诊断消费同一清单，复用原 operation.lock、process state、中心注册/目录/维护 CAS。没有第二调度器、runner pool、adapter 或进程监督器。backend-release/host.mjs 保持原字节，两条未用 host scope 已原子归还。

CLI 接口为 `message-settings --directory <installation> --request <private-0600-json>`。request 仅 `{format:1, choices:[完整tuple...]}`，复用现有 claudeTurnSettingsConfigurationSchema（≤32 choices/16KiB）与 executionProfileConfigurationSchema；不能任意 model/thinking/effort/speed 笛卡尔组合。access 固定 none，不增加读权限/工具授权。这里配置公开目录能力，既有账户与模型资格仍 unknown；本片没有传递新的 provider 许可。

登记先 wx0600/fsync 持久 intent，再创建同 uid 的0700目录/工作目录/0600 manifest，最后一次中心注册及不可变 descriptor。所有读取有限64KiB/NOFOLLOW/regular/nlink1/self，目录和 manifest 启动前核身份/内容。未知 ACK 或中途失败保留 intent 与原目录，不再注册、不换 key、不覆盖。成功后的 profile pin 独立持久；只读 status 不创建 pin。后继退役/修改配置不在本片。

目录最多4页×100条，使用既有 settings header/codec；必须 runnerId/profileId/configDigest 及完整 configuration 一致，重复/缺失/错 profile 均未确认。ready 是配置发布确认；actualClaim、provider 和账户资格不由 PID/目录提升。旧会话继续原 pin，不能隐式迁往新槽。

## 生命周期与失败

start/status/stop 与 drain→hold→refresh→resume 使用同一槽位清单和实际 process records。默认三角色不变；显式设置后 center/legacy/settings/web 四角色，settings 的物理 role 仍 runner、受限 recordKey 为 runner-settings。诊断只允许已声明槽及其 nonce/PID，不能用任意字符串扩展 state。

激活确认旧三角色与接受状态、已审 artifact runtime 后，只登记/启动新槽；旧 runner/config/manifest/workdir/process records 不改。新槽失败保留首错和独立 cleanup，绝不为新槽失败停止旧三个服务。未知 registration 仍不会隐藏 stop 时已有记录。

维护逐槽保存同一 operation 的独立 key/CAS version/runnerId/configDigest；任一活跃工作阻止 hold/stop，任一进程 unknown 阻止 refresh。hold 完成后复核全部 maintenance/active0，按反序停止全部实际槽，复用原启动入口。部分 resume ACK 后重放同一 key/version；较晚 accepting version 不冒充本次 ACK。状态汇总包括全部 active/uncertain 数与逐槽事实，部分状态为 mixed。停止进程不证明任务取消或实际领取。

## 固定产物与下一准入

settings 槽拒绝无 artifact 的旧 runtime，完整 artifact 验证仍沿原 backendRuntime；七个宿主模块必须与当前受审 implementation 字节相同，旧单槽 host 在任何新槽启动/维护前失败关闭。具体 CORE 提交/单文件 SHA 不进入长期产品逻辑；后继部署材料必须绑定实际产物同时包含本片与 main677a 已审 mixed queue 资格。当前本树基线0da不含 CORE，既有个人7d1/source6c也不含此新宿主，均不能作为设置槽激活目标。profile/PID不代替该资格证据。

新 artifact 构建/独立审查后，另安排专库注册→发布→目录和 Web/TUI 直接消费者，再受控个人激活；保持旧 namespace/session，核全部槽维护及失败恢复。模型/账户后验单独预算。本片只提供已固定模块，NOT_ACTIVATION_READY。

## 资源与已有证据

[validation-summary.json](validation-summary.json)记录7轮44选择/33不同（30新+3原直接消费者）、原1个夹具错 target 失败和定向修复，最终每个不同用例通过。累计3444ms/raw11838B，7组最终 absent/双EOF，exact空scratch全部移除；历史 pre-reap unknown 原样保留。局部使用 VM 注入中心/PG/进程端口与真实自有小文件，没有实际服务/PG/浏览器/provider/个人配置读取。

预算累计≤240s、tmp≤32MiB、raw≤2MiB、同时≤4自有children，OPS14监督；临时峰值未采样，不声明原子峰值/物理可回收。未重跑历史 PG/Web 矩阵或旧全套。真实 publication/claim/双端/个人激活/模型资格均 NOT_RUN。架构从单runner变为有限二槽，由 Execution Lead 在集成时更新基线。
