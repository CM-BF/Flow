# SVC04 evidence

固定实现见 manifest.json / canonical status。单owner runner_owner/gpt-6-astra；FLOW-001 / Execution Lead。当前为自有fixture验收，未更新个人安装，也没有provider/auth调用。

## 检查与来源

15个不同Node行为（原14 + 1个版本读取竞态）：module-final.txt 11/11（release域4、artifact6、旧static1），host-final.txt 1/1真实随机PG/HTTP与独占center/确定性runner/Web，consumers-final.txt 3/3中2项为旧start/maintenance直接消费者、namespace与前11重叠。asset-queue-final.txt是原hot-publish case扩展20个同时HTTP资源的重叠定向复跑，不能再累加。observation-gate-final.txt为新竞态1例与原HTTP/SSE例1个重叠定向复跑。syntax-before-queue.txt 9文件与static-syntax-final.txt覆盖JS语法，无新增TypeScript产品文件，因此未重跑全库types。

实际命令均使用 `/opt/homebrew/opt/node@24/bin/node`：

```
node --test tools/personal-preview/web-release.test.mjs tools/personal-preview/web-artifact.test.mjs tools/personal-preview/static-web.test.mjs
node --import tsx --test --test-name-pattern='Web-only bootstrap' tools/personal-preview/preview.test.mjs
node --test --test-name-pattern='^(starts an owned|bootstrap enables only|release namespace)' tools/personal-preview/preview.test.mjs tools/personal-preview/maintenance.test.mjs tools/personal-preview/web-artifact.test.mjs
node --test --test-name-pattern='hot publish' tools/personal-preview/web-release.test.mjs
```

host用flow_preview随机独占数据库，正常DROP并输出remaining[]。两个实际受理且绑定合成profile的任务在Web-only bootstrap、并发发布（仅一方成功）、rollback、Web端口冲突unknown/显式恢复期间保持原attempt与center/runner身份，随后均succeeded。fixture中没有Claude SDK/query，名称claude仅测试现有公共合同；不把合成成功称真实自然语言/模型能力。后台源码记录40f1e13，最终分支apps/server/runner与其无源码变化；只Web host工具发生变化。

编译后合成Web consumer实际执行authenticated reads、固定profile普通send、同key/body显式重放、legacy/stream/profile协商。两份Web artifact的source与真实backend source不同，已验证组合可通过，未知组合/缺检查/变更证据拒绝。兼容原始声明从host-final.txt逐字重构在compatibility-fixture-results.json，并复核四raw hash与report ID；这些声明只针对此fixture，绝不能用于给真实产品Web或personal backend签发兼容。

## 浏览器与并发

browser-fixture.mjs用真实Vite构建12个冷启动模块+8个延迟模块（各约128KiB），仅自有loopback记录proxy与静态宿主，没有第二产品center。声明仅为静态机制fixture，非公共API兼容证据。通过cua控制独立Chrome标签，不使用networkidle，不触碰任何用户标签。

首轮真实冷启：4个JS请求503，页面停booting，实际查看截图；browser-cold-red-network.txt保留。修复为4正在发送的资产响应+32 FIFO等待位、5秒超时，队列不读文件，断连移除；不放大无限并发。修复后实际观察5个阶段：旧页cold12/12，发布后旧页首次延迟模块8/8，新页cold12/12，回退后新页首次延迟模块8/8，回退后的新tab cold12/12。58个JS请求均200；唯一辅助favicon.ico 404明确保留。browser-ready/publish/rollback/final_network.txt保存实际HTTP记录，browser-observations.json保存所见DOM与计数。失败和最终截图在工具中实际查看，但未保存截图文件；不谎称有本地PNG。

三成功标签与一失败标签均显式关闭；两fixture的临时目录/服务器已清理。交互TTY退出在资源清理后仍等stdin，实际发送EOF后两进程exit0；脚本随后加stdin.pause以免下次留等待，不重跑build/浏览器。该一行仅fixture退出，不影响已观察的产品行为。

## 红与限制

- domain-red.txt仅新模块不存在导致加载失败；不当成行为red。
- host-fixture-first-red.txt：测试fixture的assistant-final误用内容digest作messageId，被真实中心拒绝，任务未最终成功；已按固定session+source UUID身份修正fixture，下一次实际成功。不是通过修改中心/降低断言绕过。
- module-first/second、host-first-green保留阶段输出；后续必要consumer扩展另列，不拼成一次大套。
- 本地测试/结构化声明并非任意API语义自动证明；必须为实际产品Web/backend组合提供独立验证。运行中设置、后端未来行为变化、浏览器完整业务矩阵仍须具体消费方验收。
- Web-only bootstrap可能短暂断观察；失败保留旧artifact/source并报告Web unknown，不保证新进程启动失败时Web继续在线。center/runner不停止。
- 3个retained artifact/192MiB，准备新namespace时已有3个完整缓存也拒绝；32兼容记录；无自动TTL/GC/prune，满额需后继明确旧tab关闭的清理操作。旧tab只保证保留集合内资源。
- 未验证断电持久性、OS不可变、公网生产、Windows、多安装容量或真实provider。没有个人部署/浏览器草稿迁移/后端自动回滚。

## 预审并发读取修复

Lead指出版本文件在串行链外读取会把合法旧in-flight观察误判回退。新增窄createWebReleaseSnapshot seam，读取/版本判断/完整集合加载同一串行段。确定性测试先捕获实际旧磁盘记录，再发布并让较新观察先返回，原算法按预期WEB_RELEASE_VERSION_CONFLICT失败（observation-race-red.txt）；修复后1/1通过，实际磁盘回退/同version异body/文件消失仍拒绝，恢复正确指针后可读。最初真实readFile+两个event-loop tick版本没有稳定制造反序，单次通过记录为observation-race-initial-nondeterministic.txt，不能当red或额外coverage；改为读取边界受控返回实际磁盘记录后才获得确定性red。

有界准入现在在snapshot之前，最多4个工作包含读取/验证/响应，32个等待不进入观察链；取消中的工作直到读取结束才释放名额，避免请求断开提前释放而累积未完成加载。API代理仍绕过。最终仅新竞态+既有HTTP/SSE并发资产例2/2，浏览器/PG/其余14未重跑。原浏览器结果绑定上一固定实现，最新增量由该定向检查支持，不改写原始输出。
