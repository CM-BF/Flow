# SVC08 隔离 Web 宿主实际结果

一次固定 Flow422 / c7b 产物的实际 Web 宿主通过。原 CLI、角色选择、安装 marker、nonce、Vite 与静态文件服务均实际执行。结果待独立审查；个人安装和 Web-only 替换未执行。

实际 work 为 2026-10-07T05:20:27.448Z–05:20:48.080Z，cleanup 为 05:20:48.173Z–05:20:48.327Z。OPS14 两段分别 20,735ms / 257ms、exit0、双 EOF、最终组 absent；合计 20,992ms 是监督段累计，不是包含最终持久化的外层总 wall。首个 EPERM/unknown 观察保留，未改成始终 absent。

- 1 个场景、7 项断言通过，只有 3 次 HTTP：identity、首页、一个实际 asset；内容与固定 d629 字节/hash 相等。
- 原配置 bytes 与除 Web 记录外的合成 state 保持。center/runner 是未运行的保留哨兵；没有实际后台或个人服务保留复验。
- Web 原组 38676 由原 `stopOwnedProcess` 正常确认 stopped。matching nonce 的显式 stop 退出码是 **1**，原样记录，不称所有服务 exit0。默认 `stdio=ignore` 未改，不声称取得服务内部 stderr。
- 专库 OID 1226143 与 marker 一致，连接观察 rows=[]；持久化清理 checkpoint 后 normal DROP，remaining=[]。未 force、未重试。
- 原 c7b、精确副本与私有 run 全保留；没有构建/安装/模型/任务/runner/Chrome/个人操作。

CoW 副本 12,599 regular files / 2,205 directories / 742 internal links；regular logical 366,318,536 B、allocated 401,088,512 B。allocated 与卷 free 变化均不证明独占物理成本。最低采样 free 25,128,849,408 B；最大非 artifact 私有样本 1,614,931 B。采样不是原子峰值。原件副本及 outer 共 31,347 B，低于 2 MiB；固定输入与派生摘要另列 manifest。

[原 outer](web-host-outer.json)、[逐值摘要与私有绑定](result-summary.json)、[原件副本](actual-raw/work-result.json)、[独立清理结果](actual-raw/cleanup-result.json)、[先行 checkpoint](actual-raw/cleanup-checkpoint.json)。原件均保持在 `/private/tmp/flow-svc08-web-host-20261007`；配置凭据只留私有目录，Git 仅保存 hash/identity。

本轮沿已安装 find-skills / clean-code 方法复核职责、错误与资源边界；使用已审模块，无新生产实现。API 代理、3 个 retained namespace、旧 tab、个人同锁 replace-host 和长期连接稳定性仍是后继；本片不扩大旧结果或个人根因结论。
