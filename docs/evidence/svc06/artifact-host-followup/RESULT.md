# 固定产物的零任务真实宿主验证

一次实际运行通过，结果待 Execution Lead 独立审查。入口 `d37981b06ec70b9f9e6254b66e0a1b69d7555dc1`，产物 e5 / source3230；运行期间不重建或安装，不创建任务，不调用 provider，不操作个人服务或用户页面。

调用开始 `2026-10-07T04:31:30.466Z`；exclusive reservation `2026-10-07T04:31:30.565Z`；clone与原manifest校验后真实host阶段 `2026-10-07T04:31:41.750Z`→`2026-10-07T04:32:07.796Z`；独立清理 `2026-10-07T04:32:07.889Z`→`2026-10-07T04:32:08.205Z`。work owner37,293ms、cleanup449ms，合计37,742ms；外层退出0，完整EOF，两个监督组最终absent。外层未保存精确退出时刻，不能以清理finishedAt替代。

新root中三个真实服务均ready：中心与runner启动、32迁移、零任务，Web身份/固定静态index字节/中心代理通过；同一profile负控制对四个开发路径及realpath别名均返回EPERM。原nonce/PID/runService/stop真实运行，只有已审实验端精确spawn变换将服务子进程放入拒读环境，可信身份监督留在外层。此为固定服务代码在该实验隔离条件下运行的证据，不是默认生产部署链或通用安全沙箱证明。延迟import复用原构建证据，未再跑一遍。

精确CoW复制12,584个常规文件、2,205目录、742内部符号链接；原manifest再次全验通过，0普通copy fallback/安装。常规逻辑366,131,114B，st_blocks×512 allocated400,875,520B；clone时卷余量差-8,220,672B，不能当独占physical或可回收量。fresh25,642,360,832B≥2.5GiB；运行样本最低25,607,331,840B，私有runtime最大样本3,230,892B（不含固定artifact）；52次加末样本不证明原子峰值。canonical raw 37,410B≤2MiB。

清理复用原helper，Web/runner/center三组均stopped。诊断保留 **Web exit1**（显式stop收尾观察），center/runner exit0，三个capture errors[]且输出0B；不能写成全部服务exit0。DB marker核验、OID1208860和2.018375ms零连接观察后先持久checkpoint，再normal DROP，remaining=[]。监督中早期EPERM/unknown观察原样保留，未被最终absent改写。Lead已正式归还共享窗口。

[完整外层](host-followup-outer.json)、[实际work](actual/work-result.json)、[清理checkpoint](actual/cleanup-checkpoint.json)、[清理result](actual/cleanup-result.json)、[clone](actual/clone-result.json)、[汇总](result-analysis.json)、[原件来源](raw-provenance.json)。私有原始配置/凭据/诊断未发布；e5原根、新副本与private run均保留。旧e6ff失败/独立收尾不改。refresh/resume、旧数据兼容、真实App、个人部署仍open。

本段 clean-code 复核：仅结果与元数据，入口/生产源码未改；证据单一原件、失败与清理分离、时间与空间口径区分。没有新增工程检查。
