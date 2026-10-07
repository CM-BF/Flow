# D06 a28e 第二浏览器候选：仅静态准备

目标a28e8dac9ab3bd56231c13a0b090e986cc69eb0d，原5124 data/策展0da不变。首轮几何FAIL及完整清理获root接受；renderer真实bbox修复仅源码获审，不冒新页面通过。当前metadata最终HEAD由本次唯一metadata封存后写binding，原包不改。

原scenario.mjs逐字1cc45f2b…不变：原5图×1280/390×light/dark，20观察/20PNG，节点与edge的实际SVG bbox/背景/canvas、固定源码下钻、Enter/Space、窄屏图内受控横滚及页面不溢出。没有放宽断言或改产品测试，仍只自有静态资产server，不引PG/真实snapshot/个人服务/用户tab。

本次总83267ms=68267work+15000cleanup；原6733ms保留，原90s不重置。父旧85/87.5/89s清理节点同减6733ms；worker timer也改68267。自有scratch256MiB，原总raw8MiB含首轮19原件1386844B与本次outer最多65536B，因此本次raw上限6936228B；所有旧原件pin绑定并核，不复制或改写。原采样/软停止/双EOF/group清理方法不变。剩余预算不是运行授权。

native sandbox/profile/cache/inherited own group的原边界相同，但新parent/worker精确bytes必须root审和新的boundary接受；不继承旧gate。本包PREPARED_NOT_RUN，无gate/consumed/raw/scratch/outer，无预约。唯一未来命令：`python3 /private/tmp/d06-browser-a28e-4mmyk_zp/run.py --gate <fresh-manager-gate>`。实际运行必须fresh claim/pins/currentHEAD/资源与明确heavy交接。

真实验收需outer实际exit0、完整最后父stdout/磁盘/worker/browser一致、5groups/20PNG及几何语义断言、双EOF/Chrome实际exit/ownedgroup与scratch清理；早diskPASS不单独成立，所有失败原件保留，无自动第三run。外层真实wall与父晚终态保守较大值记账。

静态仅Python ast.parse、Git/文件hash与差异核；0Node/import/Chrome/HTTP/PG/free/proc/install。原22已过不重跑。clean-code复用已实证父/worker/scenario，改变只为新source/路径/剩余预算和保留证据总量；不新建监督框架。未验：新renderer布局、二次完整五图与实际资源生命周期。
