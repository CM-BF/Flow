# 原失败资源的单次受控收尾

限定此处固定 PID/PGID 73345、nonce、原 e5 artifact CLI 与 private directory，以及专库 OID 1206953。原 pending、state、work/cleanup UNKNOWN、全部原 raw 永远不覆盖；不是 host 重跑、不是个人服务操作。

外部可信 observer 不进入原 sandbox。它按原 process helper 的完整 ps 格式，两次记录 leader 和整个小组每个成员的 PID/PGID/startedAt/command；leader 必须精确等原固定 artifact CLI/private directory/nonce，历史 command SHA 与 startedAt 同时匹配。两次全值必须相同，并由原 inspectOwnedProcess/ownsListener 再确认。完整 command 仅留新 0600 私有确认文件；公开结果只保留状态。

原 root/run dev+ino/uid/0700、六个原件 dev+ino/0600/hash、三个运行源码 hash 均须匹配。只从已保存原配置内存取 DB URL，不打印或复制 token/连接串。不学习替代 PID/namespace/DB。独占新 cleanup-followup-first/ 与 exclusive outer 防止同路径重放。

执行顺序：fsync+dirsync reservation → 两次完整身份 → 私有 identity-confirmation → 原 assertPreviewMarker 与原 OID → 原件重新匹配 → 0600 durable cleanup-intent → 原 stopOwnedProcess 一次 TERM/最多5s、无KILL → 整组 stopped → 私有 stopped 记录 → marker/OID再次同值 → 原 observeConnections ≤3s/最多60次/每次LIMIT33与剩余 query_timeout → stopped/OID/root再次匹配 → 先 durable cleanup-checkpoint → normal DROP 精确专库 → remaining=[]。不删除 artifact、root 或 private run。任何异常/未知保留，不重试或强制结束其他会话；primary、pool close、持久化错误分别记录。

OPS14 同一个 CHILD_PID_ONLY 27s工作+.5s TERM+2s reap，≤29.5s停止/收割边界；只监督本清理 worker，原 center detached 组仅由固定 helper 一次作用。fsync完成时间不冒充硬墙钟上界，outer的停止决定先于结果持久化。私有新增证据≤96KiB、capture8192B、外层原件≤128KiB，合计≤256KiB。fresh保留1GiB+256KiB；0tasks/provider/Chrome/安装；未执行。

后继 host 只需把可信 spawn/identity/stop 监督留在 sandbox 外，真实 center/runner/Web 才在继承的拒读 profile 内；harness 放自有 tmp/产物，四条开发路径负 probe 保留。须另固定可审入口后运行，不复跑已绿构建/import，不把本清理成功当三角色通过。

本段应用既有本地 find-skills/clean-code/codebase-design：私有固定一次组合、重用 process/marker/连接观察/OPS14，不造新生命周期框架；检查错误保留、顺序与职责。仅静态语法/固定命令 hash核对，无服务探针或产品测试。
