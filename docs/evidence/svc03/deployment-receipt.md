# SVC03 实际切换回执

所属大task：FLOW-001。Co-lead：Execution Lead。唯一operator：runner_owner / gpt-6-astra。归档时间：2026-10-06 08:57:42 UTC。

Execution Lead 明确授权固定main/origin `b1c2e39837c2208e6fc2c59a80e16797f26448b5`，现在至09:10 UTC一次受控预构建→bootstrap/drain→hold/refresh→fresh核对→一次显式resume；全部gate满足不等待第二审批。Lead接收 accepting 回执后已宣布窗口关闭/main解冻。**此后无服务操作、模型或采样。**

- 最终观察 `2026-10-06T08:55:54.634Z`：maintenance **accepting v12**，同operation `3dd38d12-d7f9-4253-828b-6f8ff7edc585`。bootstrap v10、refresh v11 ready-paused、resume v12三个CLI均captured exit0。
- backend source `b1c2e39837c2208e6fc2c59a80e16797f26448b5`，clean启动记录；静态Web artifact `461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90`，manifestDigest同值、sourceHead同T。backend source与Web内容标识分别记录，完整文件集校验和HTTP serving identity confirmed。
- owned PID/PGID：center71483、runner73368、web73413均running，center61227/web61228 listener归属匹配。原DB/config/runner credential身份/ports/native配置及runner目录身份保留。无第二center或新runneridentity。
- 4 task全部succeeded；全DB未完成attempt0；queue promoted1/waiting0。全DB唯一registered runner，capacity1/claude，未改steering或并发。迁移version列表与受控前相同。
- **0 operator query/provider request，0 tab reload。** 只核静态HTTP identity/状态，没有新模型健康消息，也未声称当前用户tab已载入新bundle。现有页面保持原样；下次明确刷新会读取静态版本。

## 保留的中途误报

第一次operator driver在refresh成功后把descriptor的JSON字段顺序当作身份差异，保守报 `READY_IDENTITY_MISMATCH` 停在v11 maintenance。新构建descriptor字段顺序为artifactId/sourceHead/manifestDigest，复用缓存返回artifactId/manifestDigest/sourceHead；三个值都相同，产品的identity校验本就逐字段判断。

没有改产品、没有再bootstrap/refresh、没有重跑模型。只读status确认三个新进程/内容身份正常；第二个一次性driver改为逐字段比对，重新核所有runner/全DB工作/同operation/source/端口/业务摘要和私有配置不变后，按既有同窗口授权执行**唯一一次resume**。初次输出与脚本完整保留，未改成成功日志。初driver实际catch设置exitCode1，但shell末cat令工具exit0，未单独捕获Node退出码；这一测量限制明确保留。resume driver独立捕获exit0。

## 数据摘要的确切边界

比较的是各表count与所选元字段的排序聚合digest：task状态/版本/游标/当前attempt与产物关联；attempt身份/owner fence/sequence/native归属/完成时间；conversation revision/请求设置/所选profile/queue控制；turn identity/顺序/task关联；queue identity/顺序/状态/关联/时间；profile identity/config digest；session归属/占用。**不是全库备份、不是用户正文/工具详情逐字保留验证。** 未读取或输出用户prompt/reply/tool正文；任务元字段、配置身份检查与原流程保持提供本窗口所需证据，不扩大为完整数据库保真证明。

全程私有配置只在内存认证与byte一致性比较，未复制入Git或输出值；原native配置byte与runner目录inode/device保持。snapshot不是锁：维护的durable guard/同runner原子hold才阻止新claim，且没有PG事务跨stop/start。当前已明确单安装；此回执不证明未来不存在其它部署。

证据：[部署manifest](deployment-manifest.json)、[首操作/保守停止](window-result.json)、[fresh核对及唯一resume](resume-result.json)、两份console与一次性driver。原d938源码和13份实现raw均未改变。第一次静态部署没有旧静态artifact可自动回滚；无自动DB回滚或旧dev恢复。
