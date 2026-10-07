# Steer第二轮：有效诊断，整体FAIL

2026-10-07 10:04:43 UTC。执行 `f0a97719f470e7536c705cc3fac2453b634c5978` / source `a8e8aa3eba74abe400b3cbd9d4788d8e9d63d90e`；run `recsteer-20261007-100004-46e3cb`。仅cookieRead通过，steeringRecovery仍在首draft五秒predicate失败；未到Steer POST、ACKloss、恢复或retry。

[原11raw/27702B和10outer原件](steering-second-manifest.json)，[root独立实际审](steering-second-root-review.json)。本轮inputMatches=true；同conversation draft version4存在但steering为空，另一route draft version1也为空；recoveryAlerts和observationErrors在本次采样为空。fixture observer直接返回getAll原记录，不主动过滤steering。没有截图，空alerts不证明全程无错。

真实App原turn202、synthetic actor一次成功claim和一次session已到（4次有限readiness claim请求）；没有runner/SDK/provider/heartbeat，不冒native应用。actualexit1/双EOF，markedDB0conn/normalDROP剩空、fixtureclosecomplete，4PID和3PGID ESRCH、scratch和exactadminenv已删除。独立端口未采样，不补造事实。

outer17420.67970801145ms、late16866.963875、parent16853.57675保留，charge17421；新60sphase累计34753、余25247低于原入口最小30000，**不再第三次运行**。旧90/150与首红不修改，当前0holder/gate/env。原段结果不是完整feature通过。只读因果链和后继最窄方案见[静态诊断](steering-second-diagnosis.md)。
