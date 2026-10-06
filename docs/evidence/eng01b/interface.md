# ENG01B 首Interface

base c5bab40；0provider。有限工程配置与Native profile分开编码，复用既有ExecutionProfileReference和flow.execution_profiles同表immutable/runner唯一机制，不新增registry/migration或改旧Claude/Codex字节。

公开合同 packages/contracts/src/engineering-profile.ts：engineeringProfileConfigurationSchema / Json / PublicationSchema / ProfilePublishedSchema / PageSchema及相应types。configuration严格为protocol flow.engineering-profile.v1、harness fixture、adapterVersion engineering-1、purpose engineering-fixture、recipe calculator-v1、project{id,baseCommit}、checker{id,version1,baselineDigest}、limits{checkerTimeoutMs 1..30000}；无model/provider可用性暗示。profile source=trusted-fixture-setup、availability=not-probed，引用仍{id,runnerId,configDigest}，page独立protocol。

固定共享薄出口（Lead实现）：runner凭证 POST /api/runner/engineering-profile → EngineeringProfilePublished；owner GET /api/engineering-profiles?after&limit → EngineeringProfilePage；client publishEngineeringProfile/listEngineeringProfiles使用严格响应schema。center工程Module registerEngineeringRoutes(app,pool) 供server mount。旧Native发布/目录入口不接fixture配置。

工程intent在engineering.ts新增optional profile引用以兼容已存receipt读取，新受理与claim必须有匹配工程profile，校验purpose/targetRunner/project/base/checker及revoke；不借top-level native executionProfile，故tasks.ts目前不必写。普通任务遇工程runner profile在claim前排除；conversation/goal引用工程profile时既有Native codec拒绝。历史unprofiled engineering任务仍可读，不能继续被新路径领取，需明确重新提交已配置task，不偷偷升级已存验收输入。

runner setup仅接受受信本地文件选择recipe/projectId/checkerTimeoutMs，存储位置沿既有host workingDirectory的自有工程子目录，不接task给出的路径/source/expected/executable/argv/env。create/load只接受自身marker与固定recipe，校验root身份、repository/base/checker/source、配置digest和published pin；marker不符/半建/unknown active lease保留并拒绝，不删除重建。实际write发生在原host claim/ownership guard之后。main通过显式互斥工程setup入口组合现runRunner，runtime/outbox/admission不改、不建第二调度器。

共享store已由原owner停写并v4原子移出，受控合入已审main 21e0a56c4b2b65a04a1e8d510a9d132e77c3894b后，ENG01B writer v2正式追加store/publication。新helper只服务有限已识别codec，固定flow.execution_profiles表，不接受表名/任意registry。公共contracts/index/client/server挂载由Lead协调唯一writer。

合同interface-only固定 6c9fbfde15e27ea5be69ef53b6e74d0ec5b83664，工程领域尚未独审/main。main新增 FLOW_ENGINEERING_SETUP_FILE，拒绝与Claude materials/A2A并用；此首片专用单project local concurrency固定1，S01旧native并发保持。取消/事件/journal仍由runRunner拥有，配置启动失败只报既有固定错误。

已实现入口：loadEngineeringRunner({baseUrl,token,workingDirectory,manifestFile,signal?}) → HarnessAdapter；先本地prepare/restore，再共享client发布并确认完整canonical+digest，最后绑定immutable pin。publication请求≤5s，cancel不启动宿主。错误由main旧固定消息输出，不泄露本地path或原异常。新增recipe需在setup有限定义及codec中明确授权修改，调用方不能任意注册命令。工程profile最多目录100条+sentinel，project保留≤8个worktree，不自动删除未知资源。

实际信任边界：runner token授权的是配置发布者身份，不是远端二进制/工具隔离证明；中心只核验可信宿主receipt的关联，source分类不代表探测可用。普通fixture误配置为target但未发布工程purpose会在新受理前拒绝；老无pin排队不领取、不暗中升级。
