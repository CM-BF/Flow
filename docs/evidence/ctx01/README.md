# CTX01 证据与方法

2026-10-06 04:42:05 UTC：Astra owner实际读用本地find-skills、codebase-design、clean-code、tdd，固定clean-code来源bdacd76不重装。小host接口把kernel状态与内容store封套，直接测公开core和已授权host seam，不造生产适配器/PG。先固定来源与许可，再实现/运行；最终交付复核错误/副作用/命名与统计口径。

官方npm0.0.101元数据、tarball SHA512与给定integrity一致，gitHead4d38906e004e7fd9fe4b0c06cbd8c661694f506f。公开registry Web读取器失败，直接HTTPS读取官方registry并保存原JSON/验证tarball成功。无安装依赖或生命周期脚本。只保留运行core所需未修改bundle/两个chunk和原package.json/LICENSE，完整hash见provenance.json，不引persist/wire/panel。

许可：实际LICENSE是MIT正文加产品表面/文档署名条款，不能只根据package.license写成纯MIT。**本实验使用[acp-kernel](https://github.com/ranxianglei/acp-kernel)，保留完整原始LICENSE与来源。** GitHub0.0.104不作为本API依据；billion-context/pi未安装未测。

剩余实验结果未生成，review NOT_STARTED。0模型/0云服务调用、未读凭据、不改产品deps。

## 2026-10-06 04:45:12 UTC 实际结果

固定源码零模型公开行为3/3；[红例](host-red.txt)与[通过输出](host-tests.txt)分别保存。一次有界测量从2026-10-06T04:43:41.568Z到2026-10-06T04:43:49.447Z，60有效批次（1/10/100各20），总7.878s；2220合成session，累计原文8265090 bytes（限20MiB）。prepare与restart各校验8880原文ref；每次prepare/restart PID不同，原文digest一致，fork隔离检查通过，0失败/0压缩warning。无测试或benchmark重复追结果。

[原始JSON](measurements.json) SHA256 `5d633b104a23990b435c734f650a20da6dde803fd15eacc05c76231d0d8850bc`，162144 bytes；含60样本、CPU/RSS、逐步wall、进程启动wall、输入/投影/持久字节、原文/快照digest和被测脚本hash。独立脚本逐样本重算总bytes、p50/p95、PID/digest与source hash一致，不重跑负载。原始JSON不改。

### 每批步骤（毫秒；RSS MiB）

| sessions | 步骤 | N | wall p50 / p95 | CPU p50 / p95 | RSS采样范围 |
| --- | --- | --- | --- | --- | --- |
| 1 | create | 20 | 0.390 / 0.437 | 0.385 / 0.431 | 52.12–52.84 |
| 1 | compressAndStore | 20 | 3.745 / 4.011 | 4.086 / 4.358 | 52.42–53.47 |
| 1 | retrieve | 20 | 0.113 / 0.132 | 0.128 / 0.150 | 53.05–53.47 |
| 1 | serializeAndWrite | 20 | 0.957 / 1.716 | 1.368 / 1.511 | 53.05–54.41 |
| 1 | readDeserializeAndValidate | 20 | 1.240 / 1.441 | 1.277 / 1.502 | 52.20–53.72 |
| 1 | resumeProjection | 20 | 1.955 / 2.139 | 2.050 / 2.256 | 52.75–53.98 |
| 1 | forkAndVerifyIsolation | 20 | 0.260 / 0.280 | 0.319 / 0.343 | 53.00–54.19 |
| 10 | create | 20 | 0.637 / 0.724 | 0.634 / 0.711 | 52.19–53.11 |
| 10 | compressAndStore | 20 | 6.518 / 6.922 | 9.266 / 10.033 | 52.59–55.28 |
| 10 | retrieve | 20 | 0.261 / 0.297 | 0.304 / 0.380 | 54.77–55.31 |
| 10 | serializeAndWrite | 20 | 1.161 / 1.354 | 1.225 / 1.427 | 54.78–56.00 |
| 10 | readDeserializeAndValidate | 20 | 2.299 / 2.738 | 2.745 / 3.298 | 52.11–54.84 |
| 10 | resumeProjection | 20 | 3.011 / 3.385 | 3.900 / 4.367 | 53.83–55.28 |
| 10 | forkAndVerifyIsolation | 20 | 0.885 / 0.951 | 1.187 / 1.387 | 54.41–55.89 |
| 100 | create | 20 | 2.502 / 3.052 | 3.146 / 3.751 | 52.27–54.73 |
| 100 | compressAndStore | 20 | 17.557 / 18.934 | 27.319 / 29.359 | 53.91–62.92 |
| 100 | retrieve | 20 | 1.126 / 1.215 | 1.229 / 1.363 | 61.91–63.36 |
| 100 | serializeAndWrite | 20 | 5.670 / 6.939 | 5.822 / 6.751 | 62.38–68.75 |
| 100 | readDeserializeAndValidate | 20 | 9.609 / 10.449 | 10.908 / 11.799 | 52.23–61.91 |
| 100 | resumeProjection | 20 | 6.746 / 7.156 | 10.541 / 11.560 | 61.16–66.42 |
| 100 | forkAndVerifyIsolation | 20 | 6.135 / 6.941 | 6.574 / 8.000 | 64.58–66.59 |

100session首样本：原文372150 bytes，可见105390 bytes，JSON checkpoint1128281 bytes。该checkpoint包含raw历史+store，所以更大；这里只证明具体字节/引用行为。各规模进程peak RSS最高约54.42 /56.02 /69.88 MiB（包含Node和host/core，并非库独占内存）。摘要语义、真实agents并发、provider token/账单、生产CAS/权限没有测试。

### 结构/清理检查

core/runtime三个JS与tarball内容逐字hash一致，安装脚本未执行，生产rootlock/deps不变。小host封套与测量runner职责分开；失败保留结构化输出，无自动刷新/模型/第三方host。仅自己的随机checkpoint目录被finally删除。clean-code交付复核发现readme必须区分core库已有ref/store与宿主自制fork/version gate，已明确；未将存储放大隐藏在可见context缩小数字之后。无剩余实现阻塞，review尚未开始。

交付diffcheck：本地文件/脚本检查通过；逐字保留的上游LICENSE自带末尾空行，完整diffcheck仅报告该原文格式警告，未为消除警告改许可原文/hash。排除此单个vendored LICENSE后的diffcheck通过。core dist文件被根忽略规则覆盖，已明确force-add这三个已核hash的固定vendor依赖，未改根ignore或lock。
