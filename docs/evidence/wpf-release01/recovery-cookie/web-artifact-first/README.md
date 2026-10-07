# 首次固定新 Web artifact 实际

固定 source `c2311b6bd44a2a8e73e3b066be5f12bc8b153b37`，产品仅7272加1cea两file，批准target d736。复用既有 `prepareWebArtifact` / `verifyWebArtifact`，生成 format2 artifact `779acd5b8177dac2331f2552334e10d05032a7e9ce23550016ad2bfbabdb2df4`，10 files / 1,700,569 bytes。

[原件清单](index.json)、[descriptor](raw/descriptor.json)、[manifest](artifact-manifest.json)、[父结果](raw/result.json)、[唯一terminal](raw/terminal.json)、[真实外层退出](outer/actual-exit.json)、[精确归还](outer/return-observation.json)。actual outer0 / child0；15:34:52.365620Z 精确 PID/PGID18603、19878 均 ESRCH，owned node_modules 根（29links/scoped dirs）和 scratch absent。regular log writers closed；外层 stdout完整237B/stderr0。artifact store KEEP。0PG/Chrome/HTTP/provider，未访问个人服务。

父3755.846166ms / 序列化charge3756与late3756.269416ms原样保留。外层工具启动到观察actualexit0的区间25241ms包含报告/轮询延迟，是保守计费上界，不能当构建耗时基准。新150000ms段 CLOSED25241/未用124759，不转移信用、不自动重跑。

[准备源审首P2](root-preparation-first-review.json)与[修复批准](root-preparation-approved.json)分开保留。cleanup须在任何unlink前核所有created scoped-dir身份；真实normal/replaced两场景通过、独立10s段144ms关闭。原219源码/252已装包13700files的完整pins及调用器保持TMP固定原件；本目录只归档原始结果和准确引用，没有新增执行框架或隐藏脚本改名。

[Root实际独审](root-actual-review.json)已APPROVED、0blocking，核精确10assets/set、descriptor/manifest/sourceTree/lock、outer0/terminal与清理。旧consumer noEmit/单case通过不替代浏览器。新Web779a + 后台04da/cd27的四App兼容、真实Cookie/迟到logout以及个人部署均 NOT_RUN；8964的同源guard尚未更新，不能直接运行。
