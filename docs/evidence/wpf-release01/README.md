# WPF-RELEASE01：真实产品双构建兼容证据

固定脚本 **7805b7dd20b1dda1b24ecb7497b1fca84bc5a63b**，输入基线 **8d8ab520a9d43c7b9dafb22911416ee799ebf665**。最终运行 **2026-10-06T10:38:26.664Z → 2026-10-06T10:39:13.011Z**，退出 0。真实旧、新 App 各完成读取、发送、丢 ACK 后原请求恢复和协商检查；SVC04 原工具已导入并验证两份报告。独立 review 仍待执行，个人服务未发布或切换。

## 固定输入与结论

| 输入 | 完整版本 / 结果 |
| --- | --- |
| 真实后台与旧产品 Web | b1c2e39837c2208e6fc2c59a80e16797f26448b5 |
| 新产品 Web 与 SVC 工具 | 8d8ab520a9d43c7b9dafb22911416ee799ebf665 |
| 新产物 format2 releaseId | `8d8ab520a9d43c7b9dafb22911416ee7` |
| 构建工具 | Node 24.20.0、pnpm 9.15.4、Vite 8.3.2；冻结锁、独立 clean checkout、production / VITE_FLOW_FIXTURE=false |
| 执行 | 原版本 createServer / runRunner；显式注入合成 adapter，未调用 SDK/provider |
| 隔离 | 随机有 owner marker 的 PostgreSQL 专库、临时内存身份、动态端口；无个人配置或凭据读取 |
| 作者检查 | 两脚本定向 TypeScript exit 0；两真实页面旅程 PASS；每页 11 个断言派生的 SVC observation 均 true |
| 清理 | runner、center、代理、Web、浏览器关闭；随机库已删除、构建 checkout 已移除；保留私有产物供只读交接 |

读取通过实际连接表单和历史会话页；显式选择中心返回的 execution profile。代理在真实中心返回 202 后丢掉首次 turn ACK，实际页面显示 Receipt unknown。用户立即编辑的新草稿保持，点击 Retry same message 后以相同 key 和请求原字节恢复相同 turn，中心历史只有一个 turn，页面显示最终合成回复。未用 miniWeb 或直接函数代替这些操作。

协商分开记：真实 App 默认 `patch-v1` 的 snapshot 广告为 true；重载同一产物时代理只去掉该请求头，页面仍能读取，广告为 false。Profile 检查包含实际 App 默认目录/profile 选择，另有**同源浏览器 fetch**显式 `steering-v1`（并非 App 点击 steering 的旅程）；观察到 200、同一 profile identity/config，未从无差异数据推断全部 steering 能力已验证。无认证同源 GET 为预期 401。

两个页面 `pageErrors=[]`；各有三个明确允许的 console error：故意丢 ACK 后 502、无认证检查 401、既有 favicon 404。其他错误会失败，不称 console 全无错误。此 slice 不修产品 favicon。

## 产物和兼容记录

| 产物 | artifactId / manifestDigest | compatibilityId |
| --- | --- | --- |
| 旧 format1 | `461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90` | `d4afbf557c00e53088edb6442b2fff1bc995c6d02e93b105ec450f5f9f9a8d5c` |
| 新 format2 | `caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe` | `bc02d897a957d100bddb564aa18b9cae3849b5290f6c230f0630832f9dac0c06` |

[完整来源与复核](source-manifest.json)绑定两个脚本、raw 结果、四 observation JSON 的原字节哈希、实际加载 JS/CSS。旧、新 [manifest](old-manifest.json) / [manifest](new-manifest.json) 绑定完整产物，包括未在该旅程加载的懒 chunk（未声称它们的交互已测试）。[old/report.json](old/report.json) 与 [new/report.json](new/report.json) 是 SVC04 格式；report 内 checks 对应同目录四个原始 JSON，不另写手填观察事实。新 namespace HTML/已加载资源均逐字匹配 manifest。

新 format2 在兼容报告产生前由自有 Vite preview 按精确 namespace/base 服务实际构建字节；未伪造报告来启动 SVC 发布宿主。验证通过后才调用原 `importWebCompatibility` 与 `verifyWebCompatibility`。个人 pointer / release host 发布过程不在本片。

可用私有状态目录来自[环境记录](environment.json)：

- 旧：`/private/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/flow-release01-jTtQSm/old-state`
- 新：`/private/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/flow-release01-jTtQSm/new-state`

主线可用相同固定 source、releaseId 和工具链重建，**必须逐 descriptor / manifest 相等**才能复用报告；不同字节需重验，不能只比源码 SHA。此处旧产物是重新构建的 b1c2，未读取个人正在服务的产物，不能自动认为其 descriptor 相同。

## 重现与启动

在本独立 worktree，现有依赖与本机测试 PG 可用时运行：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/web-release-compatibility.browser.ts
```

使用现有本地测试 PG 的默认 fixture 管理连接，或调用者显式提供 `FLOW_RELEASE_TEST_ADMIN`；不要使用个人数据库。脚本创建并标记自己的随机库，marker 不符则禁止 DROP、仍清理其他自有资源。需要已有 Chromium 和离线 pnpm 缓存；无新依赖。原始结果路径固定，重现前应保存既有 evidence，不能覆盖这次独审依据。运行自动关闭服务，因此**无持续可用本地 URL**；本次临时旧 `http://127.0.0.1:53468`、新 `http://127.0.0.1:53471` 已关闭。

## 截图、失败保留与限制

最终源绑定截图：[旧浅色](old-light.png)、[旧深色390](old-dark-390.png)、[新浅色](new-light.png)、[新深色390](new-dark-390.png)。作者已目视新浅/深；390 图保留实际打开的侧栏覆盖状态，只证明主题/该状态，不作为完整窄屏可读性或键盘审计。完整视觉矩阵不是本兼容检查。

首四轮失败及原始日志在 [first-run](first-run/cleanup.json)、[second-run](second-run/browser-results.json)、[third-run](third-run/cleanup.json)、[fourth-run](fourth-run/cleanup.json)：依次为断言漏掉真实 202、legacy 重载侧栏 locator 时机、33 位 releaseId 被工具拒绝、修正时误伤固定 SHA 被预检拒绝。全部保留，未当产品失败或成功依据。第五轮 [结果](fifth-run/browser-results.json)已 PASS，最后仅修代理超预算异常退出与 unused import，再以本固定 target 完整重跑生成根目录最终证据。旧 v1 新页诊断不为最终 format2 背书。

尚未验证：真实 provider/模型、个人运行入口/数据、浏览器重启后 unknown 收据持久恢复、所有插件/知识/附件/队列/steering 组合、全接口或未来 Web/中心版本、Safari/Firefox/屏读。本验证固定旧中心，未以 moving main 替换。完整检查日志见 [final-run](final-run.log)、[typecheck](typecheck.log)、[HTTP旧](old-http.json)/[HTTP新](new-http.json)、[cleanup](cleanup.json)。原始数据未清洗。
