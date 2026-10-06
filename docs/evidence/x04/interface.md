# X04 Interface

固定实现 `fa2d872d718bf47c3442a4eb3ca9aefcda7d1570`，合同 `packages/contracts/src/package-artifacts.ts`，模块 `apps/server/src/package-artifacts/index.ts`。

```ts
fetchPackageArtifact(options: PackageArtifactOptions, input: unknown,
  signal?: AbortSignal, source?: PackageSource): Promise<PackageArtifact>
readPackageArtifact(root: string, artifactId: string): Promise<PackageArtifact>
```

options由可信host提供绝对本地root、显式registry；HTTP默认HTTPS，测试/明确本地配置只能对127.0.0.1或[::1]启用HTTP。根目录必须属于当前操作宿主，不支持与任意第三方writer共享。可降低但不可升高 timeoutMs=15000、maxBytes=8MiB、metadataBytes=1MiB。source是依赖注入seam，默认真实pacote适配器；产品不能让非可信请求指定source/config。

input严格 `{name, version, integrity}`：npm-package-arg核 registry/version，版本精确SemVer、名称受限小写registry格式（含scope），单一canonical SHA512 SRI。不接受tag/range/alias/git/file/URL/额外字段。metadata中精确name/version由pacote核对，tarball URL必须同registry origin、无userinfo/query/hash、≤1024字符；Agent在每次实际网络请求前只允许已核精确URL。跨源/改路径redirect拒绝，同URL循环受库redirect上限和deadline，**不声称所有3xx被禁止**。

返回artifactId、原request、format=`npm-tarball`、bytes、sha256、verifiedAt、source.registry/tarball。本地布局 `root/artifacts/<uuid>/{package.tgz,receipt.json}`；root/staging每operation随机目录、每stream callback独立body文件/hash，不混重试数据。下载产物和receipt文件sync后目录rename发布，写入模式只读；未解压/校验tar内manifest、不保证签名/可信/兼容或依赖闭包。format描述registry提供的压缩包种类，完整性只证明字节符合调用方预期。

read只接受内部UUID，receipt≤4096B，压缩包按receipt≤8MiB重新核完整SHA512/SHA256和长度，跨新caller可恢复；没有中心operation、列表发现或安装状态。这不是HTTP公开API，未挂服务器路由/CLI/Web/生产registry。

错误仅稳定code/通用message：INVALID_REQUEST、INVALID_CONFIGURATION、SOURCE_REJECTED、INTEGRITY_MISMATCH、TOO_LARGE、TIMEOUT、CANCELLED、FETCH_FAILED、STORAGE_FAILED、NOT_FOUND；不返回第三方原始message/stack/凭据。

15s是signal协作deadline，覆盖metadata/network/stream及发布前检查。不是整个API的硬OS时间上限；fs.sync/rename/cleanup可能延后。rename成功后cleanup失败会报STORAGE_FAILED，但artifact可能已发布；调用失败不等于未提交，不能据此声称不存在产物。已知artifactId可重新read；未得到ID时的operation/list恢复属于X01后继。进程硬退出可能留下staging；本片不实现跨进程janitor或停电一致性保证。caller自行重试只产生新临时文件/新receipt，不安装/执行副作用。
