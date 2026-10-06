# X04 包压缩产物

创建/更新：2026-10-06；状态 in-progress；父计划 [X01](../x01-plugin-management/plan.md)。owner assignment_review / gpt-6-astra。

已授权的有界片段：接受 registry name@exact version + 单一 SHA512 SRI，经固定 pacote 21.5.1/ssri 13.0.1 验证压缩字节，保存本地不可变产物与可恢复 receipt。独立根目录下 staging/cache；单次总时限15s、压缩包8MiB、元数据1MiB；所有重入下载回调新文件/hash。固定 registry 同 origin；不支持重定向。拒绝 tag/range/alias/git/file/URL 输入。

不读取 npmrc/共享认证、不解压/install/import/scripts/enable，不修改中心 plugin registry 或生产服务，无模型。压缩包 integrity 不证明包可信、兼容、签名或依赖闭包。

Interface：fetchPackageArtifact(config, input, signal?)；readPackageArtifact(root, id)。测试在同公开 Interface，fake transport 用于确定性故障，真实 pacote 对本机 tiny registry 验传输行为。用户已明确授权此设计片段和测试接缝，不重复审批。

- [x] X04-01 独立claim、技能/设计与合同。
- [ ] X04-02 精确输入/来源、流式上限、验证与原子发布。
- [ ] X04-03 失败清理/取消/重试/并发及真实registry局部检查。
- [ ] X04-04 clean-code、固定证据、独立review与集成。

需要共享依赖由Lead单写manifest/lock；本owner只写已领取四scope。后续安装生命周期、解包隔离、依赖图与生产挂载保持X01 open。
