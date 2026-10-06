# X05 持久下载片段证据

固定实现：`9ebb3bdd781b3667f0c164405e9a17387ce89d76`；基线 main `115b0dbdfa02db5483f9e9699852682ce699633c`。作者 assignment_review / gpt-6-astra。2026-10-06 06:34 UTC；Node24.20.0 / pnpm9.15.4 / Vitest4.0.18，0模型/云/provider调用。

实现是中心本机压缩包下载操作。X02登记的精确版本和声明SHA256，通过owner稳定key绑定到独立下载operation、最多3attempts及immutable audit；不改变X02同步plugin_operations。每次尝试先持久分配artifactID，再由X04真实pacote下载并原子发布目录；内容SHA512与版本声明SHA256都一致才记录succeeded。此状态只证明已核验压缩字节，不证明包内manifest身份、安装、可加载、启用或可信。

## 实际检查

共 **24个不同检查**：X05 11、直接旧X04消费者13。一次23/23组合运行（10.30s，含X05 10+旧X04 13）后，补一个host预分配ID碰撞检查并修测试数组类型标注，局部5/5（1.78s，其中4项重复）。不是28个不同检查，不是独立review者重跑。最终 `tsc --noEmit` exit 0。

| 原始记录 | 实际范围 |
| --- | --- |
| [final-tests.txt](final-tests.txt) | 6项独立进程、4项HTTP/PG、旧X04 13项，23/23 |
| [publication-and-admission-final.txt](publication-and-admission-final.txt) | 最新4项HTTP/PG + 1项预分配ID原子不可覆盖，5/5 |
| [final-typecheck.txt](final-typecheck.txt) | 最终完整root noEmit，exit 0、stdout为空 |
| [process-final.json](process-final.json) | 六场景观察事实、9个独立center PID/动态端口、请求计数、数据库删除 |
| [process-first.txt](process-first.txt)、[process-first.json](process-first.json) | 较早5项进程验证，保留不覆盖 |
| [red-admission.txt](red-admission.txt) | 首公开受理测试404红；随后实现 |
| [green-admission.txt](green-admission.txt)、[first-typecheck.txt](first-typecheck.txt) | 文件名含green但实际失败：server未直接依赖zod；已改复用合同schema/本地cursor校验 |
| [process-tests-typecheck-failure.txt](process-tests-typecheck-failure.txt) | 后续测试数组索引possibly undefined；仅补非空标注后最终noEmit通过 |

通过生产createServer鉴权与既有X02受理接口，额外注册X05模块的真实HTTP/PG测试；独立进程入口为本模块测试专用`process-fixture.ts`，**尚不是生产main/CLI挂载验收**。网络对端是本机tiny registry，真实pacote请求；进程fixture用gzip合成字节，未解包。旧X04真实registry测试另含合法tar和脚本不执行证据。所有DB以随机`flow_x05_...`命名、临时目录canonical path、动态端口，结束停止自有子进程/HTTP并删除专库及tmp。没有接触4320/61228。

六个进程场景：

1. queued持久受理后SIGKILL，重启完成同一artifactID；同key重放不下载第二次。
2. 锁住操作行让finish事务等待，观察完整receipt已原子发布后SIGKILL；重启按已知ID重新读hash补PG，tarball GET仍1。
3. 网络响应暂停时SIGKILL，重启无artifact则interrupted；reconcile只读、不GET；明确retry才分配新attempt/artifactID且保留旧事实。
4. 外部声明SHA256与下载字节不一致，即使SRI通过也不关联有效artifact；3次显式attempt用尽返回409。
5. 另一store可读操作，但新reconcile被409拒绝，不能执行本机文件操作；错SRI沿X04实际pacote内部重入2次，不冒称单GET。
6. 专属HTTP代理在中心受理commit后丢弃对调用者的响应，再SIGKILL重启；调用者用同key恢复唯一operation/唯一admitted审计，tarball GET1。

四项公开模块/HTTP检查：稳定key/冲突、401/403/注册版本/CAS/ref拒绝、并发幂等/轻分页/不可变audit、同store第二worker拒绝且关闭后可接任。第五个本地publication检查验证host提供UUID、二次同ID不能覆盖已发布receipt、非法路径ID被拒绝、正常失败清理staging。

## FSM、归属与失败边界

- PG受理commit → queued → running → succeeded/failed/interrupted；网络在TX之外。每store一个PG专属session advisory lock，状态写全部使用同一连接；失去连接不能经另一个pool连接继续写。stop中止协作下载、等待当前工作后释放；没有新broker。
- running/recovering重启只核对已知ID，不自动下载。没有已核内容则interrupted；明确retry创建新attempt/ID，reconcile同attempt只核本地内容。每operation最多3attempts；每attempt内部仍可能有pacote固定完整性重试（X04事实），不声称exactly-once网络。
- PG finalize失败、受理ACK丢失与rename后cleanup失败不等于没有发布。预分配ID使随后重读可定位，hash/name/version/registry/声明全核后才补录。当前实测了rename后、PG完成前的真实硬退出；**未用故障注入单独制造cleanup抛错**，该路径按同known-ID读逻辑处理。
- host `storeId` + canonical private root/marker + registryRef→normalizedURL是可信operator配置；这是本机归属约定，不是OS隔离/远程可信证明。新retry/reconcile检查store与已受理registryURL；已缓存成功命令仅重放稳定ID，允许另一center观察旧receipt，不新增工作。读取HTTP不开放本机任意文件。
- SIGKILL会留下本次未发布staging目录，恢复不会扫描/删除未知临时路径；本片段无孤儿GC/全局磁盘额度。测试只在停止全部自有进程后移除整个专用tmp。正常失败/重试各自独立temp/hash，旧发布目录不会覆盖。
- X04仍1MiB metadata/8MiB compressed/15s合作signal上限；fs.sync/rename/cleanup无OS硬期限，PG行锁等待也不归15s。进程SIGKILL恢复不证明主机掉电后的目录fsync持久性。
- 查询列表最多40轻摘要；单operation最多3attempts；history按cursor分页；所有响应64KiB上限，超限显式413，不静默截断。audit总历史持久追加而非内存全读。
- 用户operation取消、runner分发、解压/依赖闭包、脚本、安装/启用、信任/签名、本机生命周期GC均未实现。本次不改变原plugin运行状态，仍unavailable。

## 复跑

在本worktree，已安装锁定依赖；PG仅本机55432测试角色具有创建/删除专库权限。脚本仅触随机命名专库与自有tmp/PID。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run \
  apps/server/src/plugin-package-fetches/fetches.test.ts \
  apps/server/src/plugin-package-fetches/workflow.test.ts \
  apps/server/src/plugin-package-fetches/publication.test.ts \
  apps/server/src/package-artifacts/artifacts.test.ts \
  apps/server/src/package-artifacts/registry.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit
```

需保存新进程JSON时，将`FLOW_X05_EVIDENCE`设到自己的新临时文件；不要覆盖本目录原始JSON。hash/字节、固定target与最终检查命令见[manifest](manifest.json)。

后继只读候选保持：官方npm精确版本endpoint与abbreviated整packument字节/身份比较；当前未实测、不改X04的1MiB packument策略。
