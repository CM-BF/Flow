# 下一版集中保留策略：保全旧资源的发布路径

这是原SVC06-05记录内的实现规划，不改变当前安装或上限。Lead已明确授权把现散列count/bytes/report边界演进为一个集中有界策略；产品写入仍须后继独立树/精确scope。本轮只读固定4fe `web-release.mjs` 和已保存SVC08 r3，未采当前个人状态。

首个可审候选：一个私有、不可由请求参数提高的固定策略表统一给release读取、规划、资产装载和兼容报告导入使用。建议下一受控版本限定 **4个retained artifact / 合计192MiB已声明资产 / 32份已提交兼容报告**，单报告五个文件各4096B的现界保留；同时核私有stage和实际卷余量，不能把logical上限当physical峰值。count=4是本版明确扩展一个位置，既有三个ID和字节全部保留；第五个、超过bytes或report预算一律失败。不是CLI临时max参数，也不添加按TTL/pagehide/静默连接删资源的路径。若实际新App超bytes或report位置不足，先停止该发布，再按新固定需求演进策略，不能自动驱逐旧项。

`readWebRelease`、`planWebRelease`、`loadReleaseAssets`、`importWebCompatibility`必须使用同一来源，不只提高publish一行。历史三项指针/报告保持可读且不重写；CAS/version、manifest digest、完整retained兼容报告和资产碰撞检查保持。短暂stage仍受原安装锁与独占身份控制；未知旧stage不删除，不用未计入的stage掩盖空间。最窄产品候选为新`tools/personal-preview/web-retention-policy.mjs`及专测、原`web-release.mjs`/`web-release.test.mjs`，与浏览器策略接缝同时固定后只构建一个一致来源artifact。未领取前只列路径，当前docs claim不能写产品。

关键部署顺序：当前c7b/Flow422静态宿主仍内置count3，即使新operator可以写四项，它也会拒读该指针。因此先在隔离组合验证新宿主可读原三项+新四项，真实采用时先用已有Web-only replace-host把新宿主装载到**原三项指针不变**的状态，再允许独立CAS发布第四项。不能只换root CLI、只更新backendArtifact或重标c7b来宣称宿主已升级。后台升级与Web宿主选择是两个状态：原refresh保留独立webHostArtifact，故backend更新成功也不能推定Web读策略已改变。

实际顺序候选：固定浏览器host配置+集中保留策略→一次一致Flow来源artifact/自有host验证→每个旧Web与新实际backend及明确公开origin/策略组合的兼容证据→fresh安装/报告位置/空间和保留基线→按原maintenance更新后台并保留旧指针→按实际所需受控采用新Web宿主→确认当前三项仍可读→第四个真实App artifact报告齐备后独立CAS。宿主采用和后台升级先后须在固定组合中验明，每阶段持久checkpoint、fresh保留、unknown停止；无业务DML/任务取消/自动回滚。所有普通源码实现可并行准备，真实动作仍按ready-first窗口。旧af51报告不能重标新backend，新报告必须有被测origin/浏览器策略配置的固定来源；若现格式不能表达，先固定最窄有版本的报告输入接缝，不能靠source相同推断cookie配置兼容。

必要直接消费者：原3项metadata/assets原样可读；第4项成功且所有旧namespace仍逐文件可读；第5项/count、bytes、report各自拒绝且指针不变；report tuple/配置不符拒绝；旧count3宿主面对4项的拒绝作为部署顺序反例保留。只运行这些新增/受影响边界，复用既有builder/installed来源，不重跑green构建为规划提供证明。真实四App兼容及个人发布仍OPEN。
