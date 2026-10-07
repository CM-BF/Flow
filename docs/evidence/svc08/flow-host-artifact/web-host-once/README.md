# SVC08 固定Flow产物的单Web宿主

准备状态：NOT_RUN，实际PG/进程仍待固定入口独审和共享窗口。原build/import及SVC06三角色实验不重跑。产品保持bad019；本片只在原docs范围写薄调用。

## Interface 与责任

`supervise.py` 只调用固定OPS14；`entry.mjs work|cleanup` 只编排本次自有安装。真实角色选择、CLI、私有配置/nonce/marker校验、Vite启动与身份、完整进程组停止均来自固定422/c7b产物原Module。`clone-artifact.py` 原SVC06 d379外部固定文件按完整manifest调用已审file-only CoW，不复制打包器/进程监督/连接等待实现。

唯一输入 `inputs.json`：Flow422来源、c7b descriptor及原根dev/ino、固定d629的manifest/10文件、Node、原clone与OPS14 hash。唯一新0700根 `/private/tmp/flow-svc08-web-host-20261007`，已存在即拒绝。原c7b及e5不修改；不能将CoW逻辑/allocated字节说成物理零成本。

1. fresh核原root/manifest身份、源/工具绑定和空间；exclusive新根、reservation/fsync，原verifier校验→精确CoW→原verifier逐manifest校验。
2. 新随机 `flow_preview_<24hex>` 数据库，只创建安装marker；没有schema迁移、task、runner注册或provider。生成新配置与合成旧af51 source/center/runner记录，`backendArtifact:null`，独立`webHost.artifact=c7b`。这些是保留断言哨兵，不是实际后台存活证据。
3. 固定d629复制到新Web目录并逐byte/hash校验。真实 `serviceRuntime(web)` 选择c7b，真实 `spawnOwnedProcess` 启动该artifact的CLI `internal-service <privateDirectory> web`。未使用sandbox/preloader/替换spawn，实际 `runService`、nonce/marker、static-web和Vite均执行。
4. 在原owned listener成立后，有界读取identity、index和一个真实asset并核hash；仅这三请求，无API代理/浏览器/旧tab。本片使用单Web artifact的既有fallback布局，不宣称三个retained namespace或个人v3 release已复验。
5. 原config和除web记录以外state逐值/原bytes保留。工作结果原错误单独保存；外部cleanup即使工作失败也只根据原持久spawn intent、完整record与state一致性调用一次原`stopOwnedProcess`。pending/未知不补造身份、不force、不自动retry。停止group与真实matching nonce退出记录分别保存，显式stop的exit1不得改绿为0。原runService的stdio=ignore保持，因此不虚称取得其内部stderr；启动未知只能依据原exit/state与组事实保留，不能注入日志hook改变默认链。
6. 同marker/原创建OID确认、复用既有≤3s连接观察（每轮query timeout取剩余，晚zero拒绝），所有收尾观察持久checkpoint后正常DROP，验证remaining=[]。旧产物、新artifact副本及整个私有run保留；没有递归删除。primary与cleanup失败分开，未确认就KEEP。

## 预算与限制

复用SVC06原120s work +0.5TERM+2reap、独立30s cleanup +0.5TERM+2reap。clone子进程≤60s计入work，同组不另设逃逸owner；实际Web为原工具detached组，只由独立cleanup通过完整身份停止。外层文件持久化发生在监督停止决定之后，不把磁盘写延迟计为已证明总wall上限；实际outer wall另记。

fresh≥2.5GiB且满足规划578MiB+1GiB收尾较严格者；共享holder合计另由Lead协调。live≥1GiB。c7b含manifest逻辑366,318,536B；副本allocated和卷free另记，不能推断独占物理量。新增私有非artifact部分≤64MiB，raw合计≤2MiB（两个OPS14各128KiB capture，其余为原件/派生余量）；每500ms有界元数据观察与最终/不可恢复DROP前采样，均是观测停止阈值而非原子峰值保证。数据库/WAL由卷free覆盖，不以tmp字节替代。达到上限/身份未知停止后续并保留，不能使用失败窗口自动再跑。

原source有意不执行开发checkout拒读负控制；SVC06同源实验仍是独立证据。本片证明合法Flow来源实际Web宿主链条，个人安装迁入、Web-only replace同锁实际操作、三个retained/原tab及持久连接后继仍open。

## 最窄真实installation迁入候选（未执行）

沿既有tools的安装operation lock与backend store lock，不改sourceRepository/descriptor/config/state.backendArtifact。先固定个人marker/目标repo/当前source与Web选择、全部retained与容量，原c7b保留。在同卷自有staging installation中使用此固定clone+完整verifier；验证目录dev/ino、逐manifest字节与内部链接后，取得现有锁并重核目标不存在，原子rename整个artifact目录到个人`backend-artifacts/c7b...`，fsync父目录，再原verifier。目标已存在则只接受完整一致verify，未知/不同字节保留并停止，不能覆盖或删除。该procedural迁入需要单独固定exact输入/原件及独审窗口，不在本PG宿主运行内顺手操作。

迁入成功仅使现`backendRuntime(config,c7b)`可合法解析，随后才用已审固定新CLI和同锁`replace-host`，旧af51后台与runner/source不动、Web release d629/v3及三个retained保持。不可把本次隔离结果说成个人已发布；不动用户tab，不假称FIN/RST合成修复已定位个人根因。

方法：复用已安装find-skills/codebase-design/clean-code/brainstorming；选用现有真实Module，接口小且明确状态owner/错误/资源。无需新依赖/通用对象或安装平台。
