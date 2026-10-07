# OPS-METER01 — 模块局部交付

标准库计量实现固定 c1699914；本地20个不同检查在一轮20/20通过。原始[reservation](local-01/reservation.json)、[结果](local-01/result.json)、[stderr](local-01/stderr.txt)、[cleanup](local-01/cleanup.json)保留；unittest17ms、受管子进程178ms、整个caller205ms，stdout/stderr2949B。自有组49132最终两次absent/双EOF，无signals；历史pre-reap EPERM/unknown没有删除。只按最终观察收尾，私有scratch正常移除。

source-only供给115386B，未安装依赖。首次分支push因remote missing necessary objects失败；只读ls-remote确认该分支不存在后，同commit再次push成功，无重写或源变更。

覆盖regular/sparse/hardlink按path计量、两caller形状的exactexclude与增长、嵌套排除、参数拒绝、缺失/变化root、symlink不follow、枚举后消失、替换/目录断链、设备边界、special/I/O、entries/depth/time限额、FD退出和first failure保持。单个文件系统调用没有本模块硬期限；caller继续依赖OPS14。未测实时峰值/可回收物理空间。

Quick b454、当前DPERF67b4输入逐字核验，仍由原Web owners接下一新caller，历史封套不修改。本模块局部通过不等于两caller已接入或OPS大task完成。0PG/浏览器/网络/provider/个人服务。

本次own status用主线parseStatus只读核：errors/humanMissing/timingIssues均空；实际task开工与完成按唯一status记录，所有后继等待仍开放。
