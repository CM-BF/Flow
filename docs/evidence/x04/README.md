# X04：包压缩产物验证

固定实现 **`fa2d872d718bf47c3442a4eb3ca9aefcda7d1570`**。base `3d4985fca060155435b159e0467815bf8e88b8b8`，WT package-artifacts / codex/package-artifacts，owner assignment_review / gpt-6-astra。0模型/0provider/无生产服务操作。

完成精确registry版本→有界metadata→pacote流式tarball→独立SHA512/SHA256→原子本地产物发布/重新读取。未接中心operation/registry、未安装/解压/执行/启用；X01完整插件生命周期继续open。完整调用/错误/恢复边界见[Interface](interface.md)。

## 实际证据

[最终stdout](final-evidence-tests.txt)：**13/13不同检查通过，834ms**，7项公开模块/fake故障测试+6项真实pacote/本机HTTP registry测试。不是把多次相同测试累加；[noEmit](final-evidence-typecheck.txt) exit0空stdout。Node v24.20.0/arm64 macOS，固定依赖见[versions.json](versions.json)。依赖由Lead单写共享commit `9cde2414078201802db03c00888175aa776651a7`，本树受控pick `eccf8f7`；[安装](install.txt)使用frozen-lockfile/ignore-scripts，产品从workspace依赖加载，未借global npm。

[原始registry事实](registry-facts.json)实际记录请求/receipt/目标请求数/重试次数/清理完成：

- 正常真实gzip/tar fixture保存字节完全一致；只有metadata+tarball两请求。配置了合成npmrc/NPM_TOKEN环境仍没有Authorization/Cookie，脚本marker不存在，目录仅压缩包与receipt，没有解包。
- 首损坏→第二正确，真实pacote内部回调重入2次，最终134B，没有拼接首轮错误字节。永久错SRI真实2次均失败，0已发布、staging空。
- metadata.tarball跨origin、tarball跨origin/改路径redirect均在目标请求前拒绝，目标计数0；metadata redirect:error同样0。相同URL302循环实际21请求后库上限失败，不误称禁止所有3xx。
- 降低限额测试真实metadata100B、tarball10B、100ms deadline，证明同一生产上限逻辑生效。生产配置只能降低8MiB/1MiB/15s，未用大公网包压测。
- 模块测试覆盖非精确输入先拒绝、并发不同artifact归属、新caller重新校验、fake callback重入、取消/超时、存储失败不发请求、错误脱敏、磁盘bytes被修改后拒绝。
- registry套件18项资源清理全部await完成；只用专属动态端口/临时目录，无模型/认证网络。测试有使用正常公开npm元数据来核依赖版本；没有下载生产插件包。

## 失败保留与修复

[输入首红](red-input.txt)：未实现时没有INVALID_REQUEST。first-typecheck记录社区类型旧于固定运行SDK，最终对bounded packument与per-URL Agent采用窄类型适配，真实对端检验实际行为。

[first-registry.txt](first-registry.txt)保留超限时cache异步写与立即清理竞态，出现STORAGE_FAILED/ENOENT unhandled；修复为tarball请求 `cache-control:no-store`，让已固定make-fetch-happen按HTTP缓存规则不保存，同时仍显式隔离cache路径，禁止回落共享cache。

[second-registry.txt](second-registry.txt)保留5项行为绿但2个unhandled，**不视为通过**；固定库取消后会把迟到socket error再次传给Minipass。自有stream保留error listener，主iterator仍拒绝、signal仍映射TIMEOUT/CANCELLED；最终suite无unhandled。其他中间stdout保留，最终以final-evidence两文件为准。

## 精确边界

15s是协作AbortSignal deadline；未给fs.sync/rename/cleanup加硬OS终止，不承诺整个API严格15s。rename后cleanup失败可能已有published artifact，STORAGE_FAILED不证明未提交。仅已知artifactId可重读；未拿到ID的中心operation/list恢复、进程hardkill残留清扫与完整生命周期属于后继，不因这片通过而完成。

只验证压缩字节与caller预期SRI一致，不解包检查包内身份/脚本/依赖，不证明可信、许可证/兼容或签名。source URL来自显式host配置+同origin元数据，非任意URL下载端点；root为可信host私有目录，同OS恶意writer隔离未在本片实现。无生产HTTP挂载/PG/CLI/Web/模型验收。

## 复跑

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile --ignore-scripts
FLOW_X04_EVIDENCE=/tmp/flow-x04-registry-rerun.json PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/package-artifacts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit
```

官方固定来源：[pacote 21.5.1](https://raw.githubusercontent.com/npm/pacote/v21.5.1/README.md)、[ssri 13.0.1](https://raw.githubusercontent.com/npm/ssri/v13.0.1/README.md)。已读源码确认callback可重入；npm-registry-fetch未转发size/redirect，不靠伪配置保护。限制通过Node流式metadata读取与真实per-URL Agent实施。
