# SVC05 固定版本隔离兼容准备

范围：FLOW-001 REQ19 的发布前置；固定新backend362af3bac77541e5a60979326bcf4d4b8c947915。个人安装只读artifact/state白名单，不执行start/stop/maintenance/publish或用户tab操作，0provider。

[接口](interface.md)、[后续操作方案](release-plan.md)、[唯一状态](../../../plans/svc05-current-release/status.md)、[技能/质量](quality.md)。实验使用原生产createServer与真实构建App；确定性adapter仅提供合成final/verification，不冒真实Claude结果。

复跑入口：Node24/PATH下 `pnpm exec tsx experiments/personal-current-release/browser.mjs <独立证据目录>`。输入使用固定source、只读个人retained artifact；每次创建随机专库/自有临时checkout与端口，不把个人DB或凭据传入实验。依赖只用已声明版本的离线frozen安装，不写lock。证据checkpoint成功且所有自有资源关闭后才DROP专库；静态artifact在私有tmp保留供后续获准导入，不修改个人安装。

准备失败原样保留：run-1 namespace长度非法（建库前）；run-2 初次claim尚未获得assignment；run-3新增migration排序导致比较器错位；run-4项目创建响应取错层级。均为实验准备/断言错误，不能当产品失败或通过。实际最终结果与cleanup见后续固定manifest，不以本README文字代替原始证据。

2026-10-06 12:24 UTC 最终 run-5：三个实际App组合全部通过；[原始stdout](run-5.stdout.txt)、[result](run-5/result.json)、[summary](summary.json)、[退出回执](tool-receipts.json)。旧1..24迁移记录及9类旧表字段逐项保持，前进新增25/26/27；有合成历史typed final/任务/回执，真实工厂重启仍能读，原key/body恢复同turn。025新增nullable字段不冒旧字段原样相同；原schema投影比较保留全部旧字段。附件上传的固定回执与同key恢复跨重启通过，但未验证ATTACHI02 App发送附件。新增goal plan/显式goal/history轻读与context未知返回通过。

个人目录只读，原令牌/config未读入实验；测试token全自造。生产工厂、deterministic runner、浏览器和HTTP关闭成功；随机DB remaining=[]；检查点先于DROP。各失败run亦保存检查点并完成专属DB/checkout清理；仅不含凭据的自有artifact目录保留。此证据尚未独审，不能授权个人部署。

实际查看全部6张图：1280浅色三图正文/未发草稿清晰、无错误覆盖；390深色三图保留打开的侧导航，遮挡部分正文，故只证明该状态被记录，不声称窄屏完整布局或无障碍验收。没有为截图改变产品。请求数/body字节见summary；不是压缩传输、模型token、SLO或性能优劣比较。
