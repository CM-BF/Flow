# Quick controls design review — fixed f3, NOT_IMPLEMENTED / NOT_RUN

推荐方向成立：只投影当前可信 profile 的最多32个完整声明 tuple，私有筛选/候选不写 C，Explicit Apply 经现公共 capture。以下仅3个需落实的设计边界，不是已审 f3 当前 radio 实现的新缺陷；没有项目修改或运行。

1. **Apply 需要草稿归属与 opening 基线，合法 tuple 本身不能防旧弹窗覆盖新 C。** Picker:89–97 只有 catalog/context/value/onChange，无 connection/view/draft generation；selection:119–136/140–154 只检当前授权与组合，不校验 C 是否已被外部更改，sameMessageSettings:157–159 只有规范值相等。因此打开时 C=x、暂存 y，宿主切到新草稿 z 后点击 Apply，y 仍可能完全合法却覆盖 z；同 tuple 清除后重选、两个 view 恰好同 profile/value、next-draft 恰好仍 undefined 也不能靠值相等区分。最小约定：宿主以稳定 view/connection + draft/settings ownership generation 管 key/关闭失效，外部 C/归属变化使旧候选失效；组件记录 opening 的规范 C 与完整 profile 身份，Apply 在同步栈以最新 props 再核基线，再 capture 后只 emit 一次。若坚持原公共 props，可在 host 用 React key/受控 owner 边界重建而不引入第二草稿库；单纯在 effect 中重置候选不够，应在 Apply 当场门禁。更新后显示“草稿已更新，请重新选择/打开”，不得默默把旧候选套到新 C。A/B 仍由各 receipt owner 持有，不传给编辑 onChange。
   必验：弹窗暂存→外部 C 改值/同 tuple 新代际或切同配置 view→Apply不写；正常Apply只更新原 C 一次，A/B字节不变。现 browser:85–92只覆盖顺序本地样本，126–128新连接在弹窗关闭后，未覆盖这个交错。

2. **目录变化是重新验证条件，不是回滚/自动选值条件；不要把整个 snapshot 对象相等当有效性。** catalog:71–90 每次 loading/append/refresh 都换 snapshot，generation:68/80/85 是私有的且不在公开 snapshot；loadMore也使loading=true，refresh成功替换首批，失败保留旧profiles但stale=true。selection:127–132已拒stale/loading/缺exactprofile。故“Apply再核generation”应落实为当前授权 owner/连接身份 + 最新 messageSettingsAvailability/capture，而不是臆造公开catalog.generation、缓存 opening allowed 或 snapshot===opening。分页追加无关profile后，原合法候选可以重新校验保留；refresh/失败/撤cap立即禁止Apply，旧C永不清；恢复后必须核最新exacttuple，若身份/候选不符提示显式重选，绝不借相同model迁移digest。受限profile未在当前页时保当前summary；nextCursor有值提供显式loadMore，无值/empty说明当前目录未确认并可refresh，不宣称unsupported。cap revoke/restore或connection替换的 owner generation与第1项共同失效旧提交意图。
   必验：暂存期间loadMore成功/refresh删目标/401/cap撤销恢复；期间无onChange，恢复后只有当前合法完整tuple可Apply。catalog缓存累计未获32上界，32只指当前profile可呈现候选域。

3. **避免筛选形成无法自行退出的空集，四底层轴与明确省略仍分开。** 公共contract:12–20区分thinking、effort not-requested/level与speed；34–36只允许32个已声明组合，58–67判定完整requested精确成员。若各下拉只由“所有当前筛选同时满足”的结果生选项，选 incompatible model 后结果0会让其他控件也变空，用户无法修复。建议每轴可见选项从当前授权域、排除该轴自身筛选后推导并显示冲突/匹配数；即使其余筛选已互相矛盾，保留可见的当前选择与“清除此筛选/清空筛选（仅本地）”出口，可列最多32域中有帮助的已声明候选。不能选第一个、自动调整其他轴或将0匹配变成onChange(undefined)。唯一候选也显示全组合预览后Apply；thinking/effort可以同一区域但不可推导 disabled=>not-requested。明确“不附加设置”须是独立用户操作，并同样受第1项草稿归属门禁，不因关闭/empty/权限丢失触发。
   必验：声明域只有(M1,adaptive,high,standard)/(M2,disabled,not-requested,fast)，暂存冲突筛选→0匹配能键盘清筛选→选合法tuple→Apply一次；Cancel不改C，受控旧值缺目录仍可读。

来源：严格 git show f3a6a7ec89d5b3f789c49b0d8662401b23032ab2 的5文件，哈希见 audit.json；原research中flatMap行号117–120在固定f3实际为Picker104–106（只校正定位，结论不变）。复用本地find-skills/codebase-design/clean-code方法，聚焦controlled authority、局部状态与失败不丢值，无新框架/task/claim/协议。全部情景为源码推演与后继验收建议，未执行tests/Node/HTTP/Chrome/PG/free。此研究不更改或阻塞f3现有独审/浏览器准备。
