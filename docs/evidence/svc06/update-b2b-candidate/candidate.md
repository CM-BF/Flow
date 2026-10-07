# SVC06-05 固定 b2b 后台和 Web 宿主候选

当前只准备固定产物，实际构建、专库验收和个人操作均 **NOT_RUN**。唯一源码是已审主线 `b2b5612b2a63106ad0e674ddf12b2e8f96cf3388`，来源真实 `/Users/citrine/Projects/AgentHarness/Flow`。旧 4fe 候选、e5/3230 实验、c7b/422 实际部署及其证据保持原样；不把旧产物重标为 b2b。

SVC09 的策略/保留规则/配置兼容报告/选中宿主资格已经进入这个主线；SVC06 v7 只持自身 plan/evidence，不修改产品。新产物沿[唯一构建入口](build-once/README.md)复用已审 builder、离线锁、独立安装空间和 OPS14。当前 14 个 dependency 声明与 422 全同，9 个实际 builder 文件与 b2b 全同；271 包缓存仅做了有界索引/metadata 观察，内容完整性仍由真实 clone/install 核验。完整 source archive 为 996 文件 / 7,811,090 logical B，33 份 SQL 均绑定；不以源码文件存在冒称实际迁移通过。

## 可执行的采用顺序与各自门槛

1. **先交付新的固定后台/Web-host产物。** 按本次 fixed target 构建、verify 和内部 import，0 factory/provider。新 descriptor 必须是 Flow 来源，完整源码/依赖/Node 均在产物内。新产物 ID、大小与身份待实际结果，禁止沿用 c7b ID。后续自有环境验收复用既有实际 host/marker/OID/owned process 方法，不重建或重复已绿矩阵。
2. **以 legacy 配置先替换 Web 宿主。** 准备全部材料后，在独立个人窗口用固定且已核 CLI 迁入新产物并一次 replace-host；浏览器策略仍缺失/default-off，后台 af51、runner 与接受版本、d629/v3/三个 retained、config/token/原 tabs 均保持。使用迁入成功 checkpoint 继续，不重放已完成阶段。旧独立 c7b 不懂新策略，不允许以新 backend 的源码替它证明资格。
3. **三个保留真实 App 对新配置组合全部验证。** Web owner 使用固定 b2b 后台与[候选公开配置](proposed-public-context.json)，为 461a、caa1、d629 各产生 format2 报告及 read/send/recover/negotiation 四份原始检查，统一 backendHead/artifact/context。报告可提前在自有环境准备以缩短个人操作；缺任一报告不得进入后台 drain。旧 v1/af51 报告只作历史，不替代新配置。新的 Web App 由 Web owner 提供实际 App source/artifact 与报告，Quick/组件检查不作替代。
4. **新后台加受信策略，保留原 Web 指针。** 先在自有专库核固定 factory 的前进迁移和代表性旧数据；实际 factory 包括 conversation 内035，以及028→029→034→030→031→032→033，033 已挂载。配置文件仅在后续已审操作中以原 installationId、0600/private/no-follow 创建；本次未读个人身份或写文件。prepare、CLI 实际选中的 maintenance runtime、Web runtime 资格与 policy hash 必须在任何 drain/stop 前通过；runService 再核。复用原单 operation drain→active/unknown/pending 确证→hold→refresh→checkpoint→显式 resume，不取消用户工作、不清 journal、不自动重放模型。
5. **第四个 App 独立 CAS 发布。** 集中上限已是 4 artifacts / 192 MiB 资产 / 32 reports；保存全部旧三项，不能 TTL/pagehide/静默连接替代旧页关闭，也不自动退役。后台成功不代表第四版可发布。fresh 真实新 descriptor、资产总量、已有全部 report 数量/bytes 和配置 tuple 齐全后，才执行独立 CAS。历史 pointer 的 backendHead/compatibilityIds 是原发布证明；受信加载通过本次 expectedBackendHead/context 显式核新报告，不能修改旧 pointer 冒称兼容。

原 refresh 实际会依次停止 Web、runner、center，再启动 center、runner、Web；独立新 Web-host 选择及 d629/v3/retained 指针保持，不能称仅两后台角色停起。维护总截止、单次停止与 unknown 保留沿已审工具，后续固定操作还须声明新增 schema/audit/queue 变化及不变字段。未知 owned 身份/停止、未决任务、材料或数据差异时停止后继，不 force/rollback/换参数重试；不会锁住或回滚正常用户工作来凑摘要相等。

## 配置和保留预算的真实边界

候选公开 origin 为 `http://127.0.0.1:61228`，trustedOrigins 仅此项，非秘密 authEpoch 为 `svc09-b2b-20261007`。规范化 context digest 是 `81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638`。它是待 Web owner 实测的明确输入，尚未安装/启用；若实际公开入口不同，须显式更新候选并重绑相关配置报告，不能靠相同 source 通融。

[已封存尺寸](../update-4fe-candidate/retained-size-evidence.json)来自06:17:15 r3原件：旧三artifact共30资产文件 / 4,538,660声明B；3manifest / 4,906B；当时3个当前兼容报告共15文件 / 5,362B。即使第四产物用满单项64MiB，合计声明资产71,647,524B，低于192MiB；这是候选规划，不是实际新文件大小或物理占用。全部历史已提交 report 数量仍 UNKNOWN，未来必须 fresh 核32上限。单report/check 4096B、32组最多160文件/655,360原文B；manifest/目录/stat/hash开销不包含在资产声明中。

本段没有运行 PG、HTTP、个人读取/服务、provider、浏览器或安装，也未把 SVC09 的44个局部检查重跑。本产物准备、真实构建、兼容验收、个人后台更新和第四网页发布各有独立结果；SVC06-03/04/05保持开放。
