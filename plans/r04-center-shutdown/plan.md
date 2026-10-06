# R04 生产中心有界停机

编号：R04。创建/更新：2026-10-06。状态：in-progress。Owner：assignment_review / gpt-6-astra。基线：2b2fe6e02c79f1b8ccfab9409adc2c336c5d350e，候选集成分支，不代表main能力。

目标：真实生产入口收到SIGTERM/SIGINT后，停止接入、短暂等待已有HTTP请求、仅关闭本server残留连接，然后释放pg-boss/pool。保留已受理命令幂等与重启事实；连接关闭不是runner停止，也不证明丢失ACK的写入失败或成功。

- [x] R04-01 独立child+真实PG+公开HTTP复现关闭挂起，保留失败与资源状态证据。
- [x] R04-02 最小有界HTTP关闭/生产signal接线，明确强断与事务完成边界。
- [x] R04-03 SIGTERM/SIGINT、正常关闭、SSE/abortedclaim、持久受理与ACK丢失恢复局部验证。
- [ ] R04-04 clean-code、原始证据与固定提交，独立review后交接index。

范围仅派工的server/index.ts、main.ts、shutdown/及本任务文档。不改CHAT02测试，不新增依赖、不调用模型。公开main/HTTP/真实PG为已授权测试seams；短设计已随派工批准，常规选择继续实施。[设计](../../docs/architecture/r04-center-shutdown.md)。

2026-10-06 04:06 UTC：实现dc1d02fcb7e3edbf99921275d81412768bf08424冻结，9个独立用例分8+1两次通过及typecheck；R04-04等待独立审查。0模型、未集成main。
