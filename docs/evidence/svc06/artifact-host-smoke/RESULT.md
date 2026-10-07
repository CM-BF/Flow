# 固定产物宿主首次实际运行：失败并保留未知资源

固定入口 e6ff0f1f2e7743496f1f17144343a28716c03b38、原 e5 产物/source3230。一次运行：2026-10-07T04:04:40.248274+00:00 开始，work 于04:04:46.563Z保存结果、cleanup于04:04:46.650Z保存结果。原监督work6255ms/exit1、cleanup81ms/exit1；两个监督组69624/73748最终absent且双EOF。中间unknown/EPERM观察保留，不能把这两个组的退出当成detached中心已退出。

四开发路径实际拒读均EPERM，已有产物校验与自有DB/marker/Web复制阶段已走到starting-center。中心仅留下pending进程记录，没有完成nonce/启动时间/command捕获；work原错误只有Error/UNCONFIRMED，不能据此补造根因。runner/Web未启动，没有用户任务/provider调用/Chrome，也没有个人服务操作。三角色宿主能力、HTTP/迁移总数及延迟导入验收未完成。

独立cleanup保留center=unknown、database=unknown与原ERR_ASSERTION；cleanup-checkpoint不存在，未执行DROP或私有根清理。专库 flow_preview_5104378c400a8a3a11597418、原e5 artifact、运行根与全部私有原件KEEP。不重试、不另起服务、不强停，不把保留DB误写成已清理。

fresh余量25,857,392,640B通过2.5GiB门槛；12次工作采样及末样本最低25,854,414,848B。新增私有字节末样本1,621,625B，低于64MiB观测阈值；这不是原子物理峰值，也不含PG/WAL。原host-outer完整4272B、监督stdout478B/stderr0；各已保存原件另由结果manifest绑定。没有超时/输出截断记录。

执行owner已经结束；保留资源已立即报告Lead，由其决定后续只读核对/收尾边界。等待唯一结果审查，本记录不授权重跑或变更固定产物。原构建批准保持，完整SVC06-03/04/05仍open。
