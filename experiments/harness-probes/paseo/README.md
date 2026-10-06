# E01 Paseo JSONL 小探针

固定上游 `getpaseo/paseo@7a30305503c600bc46ea2a94a6750eac5cede278`，来源是 FLOW-002 已登记的本地 clean checkout；不是重新选择版本。[provenance.json](provenance.json) 记文件 SHA256。两个模块与 LICENSE 原文复制，未修改函数；Apache-2.0/第三方例外按原 LICENSE 保留。

```sh
node experiments/harness-probes/paseo/run.mjs /tmp/e01-paseo-rerun.json
```

Node24.20+，仅内置模块，无整套Paseo依赖。新输出路径、wx不覆盖。常规完成约0.2秒；独立进程组硬看门狗3秒，超限结束本探针组，临时目录清理。0模型/云，子进程只运行仓库里的合成fixture，环境仅PATH/LANG，无真实凭据。用源代码加载器执行前检查逐文件hash。

## 公开 seam 与输入

- `JsonlRpcProcess` 的公开 spawn 注入创建真实合成Node进程，stdin/stdout/stderr都是真实pipes。响应文字`中文🙂`故意分别在中/emoji的UTF-8字节中间分片，25ms间隔便于观察真实data事件；保存实际chunk长度，不用假定OS会怎样合并。
- `JsonlFrameDecoder.write` 输入2MiB ASCII payload，32个无newline chunk后才结束JSON行，记录prefix阶段是否报错以及收尾恢复长度。只证明测到的2MiB范围，不证明任意长度可行或量化内存上界。
- 发出两个timeout=null的pending请求；fixture写12,000个填充字符和`SYNTHETIC_SECRET_MARKER`后退出7。观察pending拒绝、退出通知、stderr尾部截断及marker是否保留。没有真正secret，报告只记录boolean/长度。

## 执行差异与未测范围

Node VM/type transform去除TS类型和参数属性语法，源码副本保持逐字一致；VM不声称恶意代码隔离。pino/child_process的type依赖不加载产品包，日志只收集到内存。默认上游spawn路径故意拒绝，使用模块公开spawn选项。tree-kill依赖替换成只针对本探针自有子进程的有界终止逻辑；完整进程树/平台tree-kill策略不在验证范围。子进程正常退出是实际观察，不从shim返回值推断。

探针`passed`表示执行完成、两个pending如实拒绝；Unicode/长行/脱敏观察可以暴露缺口，不能据此声称传输正确。未修改任何产品decoder、RPC、stderr策略；后续需先明确reuse/包装合同，再实施修复。未测V2分块协议、巨量数据、真实CLI、模型、远程网络或性能容量。结果见 [E01证据](../../../docs/evidence/e01/README.md)。
