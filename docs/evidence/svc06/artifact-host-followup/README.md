# 固定e5真实服务隔离后继（待审/未执行）

仅原artifact-host-smoke的最小验证入口后继。原e6ff失败、独立f46a收尾与所有原root/config/state/raw不改。唯一新安装root固定为 /private/tmp/flow-svc06-host-followup-20261007，目录已存在即拒绝；新DB/new installation/new exclusive host-smoke-followup-once。0tasks/provider/Chrome/个人操作，不重跑已绿build/import。

先从原e5逐manifest校验，复用e5原clone-store的file-only fclonefileat，按唯一manifest的15531条目复制常规文件/真实目录/内部相对符号链接到新root，再调用原verifyBackendArtifact逐manifest全验。外部symlink、hardlink、普通copy fallback均不允许。不改sourceRepository/manifest或artifact字节。源固定3230，不跟moving main。原artifact逻辑总366131114B；新副本另记常规st_blocks×512 allocated（不等于独占物理/可回收）及卷余量前后（不作本进程独占归因）。保守规划新物理578MiB含副本元数据/64MiB私有runtime/2MiBraw，fresh取其+1GiB与原2.5GiB较严者，结果仍2.5GiB，live1GiB，不能称预留空间或CoW零成本。

原OPS14与原实际host fixture继续复用：外层work120s+.5TERM/2reap，cleanup30s+.5TERM/2reap；clone exec最多60s且计入work，不新增build180s。工作者在原profile外；原artifact的spawnOwnedProcess/inspect/stop实际调用。自有bootstrap保持同一个真实PID，实际导入原CLI/internal-service/runService，原state.pid/nonce/marker授权仍真实运行。唯一变化是已局部验证的exact spawn变换：三种固定program/argv/cwd表，原env不改、同组、sandbox仅包裹真实server/runner/Web；stdio变为每流64KiB的0600私有capture，超额明确truncated/observed。观察器/证据写者在外，不安装通用hook，不声称默认生产部署已采用此实验接缝。

新负控制与三个真实服务使用同一profile/Node/envelope，实际尝试4开发路径/别名读取必须EPERM/EACCES；负控制是专用小进程，不谎称每个业务入口自身读了这些文件。正例是真实e5中心/runner/Web ready、Web identity/index原hash与代理health、taskcount0；旧import结果明确复用不重跑。三个角色实际内部spawn的诊断仅私有落盘；公开报告只含退出/字节/截断/error-code，不读出凭据或正文。

清理原helper按完整records反序正常停止，pending/unknown绝不补造身份或强杀；同组全stopped后读取诊断摘要，marker/OID/≤3s连接观察及剩余query timeout，再checkpoint后normal DROP/remaining=[]。原临时根/新artifact均保留；任何失败primary与独立cleanup原件分开，无法确认则KEEP，不重试。复制尚未完成时cleanup可以失败为UNKNOWN并保留新namespace，不删除或将no-record当成功。

局部seam3/3已独审，真实copy/PG/roles仍NOT_RUN。只待固定入口一次独审和共享重窗口，无完整产物重建或额外模型权限。
