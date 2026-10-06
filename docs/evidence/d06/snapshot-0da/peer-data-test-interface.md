# D06 五图刷新：固定源码只读接收建议

固定输入：`0da869f7bad98771177472539b5a192365c15117`。本次只读 Git 对象及已安装技能；未 import/运行 Node、测试、页面、PG、服务或资源采样。所有新 target 的运行结果均 **NOT_RUN**。原实现 owner 仍 d01_owner；此报告不授写权或运行许可。

## 1. 保留的最小 Interface

`architecture-data.js:2–6` 只导出 `baseline` 和 `views`。renderer 不需要新框架：基线含完整 commit/repository/verifiedAt；日期描述固定源码核验时点，不是常驻服务版本。五个视图的稳定 ID 是 runtime/modules/data/states/dependencies；每个视图有 title/summary/width/height/groups/nodes/edges，可选 rules/routes。节点为 id/label/subtitle/x/y/source/description/seam/locality/kind；kind 仅 flow/external/planned/vendored。边 from/to 必须命中本视图节点，dependency 表示依赖虚线，runtime 是实线，不能将 import 当网络连接。自定义路线以 `from:to` 为键，含 SVG d 与标签 x/y。

`architecture.js:12–24,26–47,63–78,88–96` 是实际消费：源码链接严格拼固定 commit；全部可见文本经 textContent；节点 description/seam/locality 只在选择后呈现；初始选择每图第一个节点。因此保留非空视图、稳定 ID、来源路径及原字段，工程细节放详情。数据刷新不需要 renderer/CSS/server 改动。当前尺寸为 runtime1120×670、modules1120×1375、data1120×1415、states1120×940、dependencies1120×650。

现 direct 第一项 `architecture.test.mjs:9–20` 已核节点 ID 唯一、225×80 卡片在画布内、三段详情非空、source 仅 apps/packages/plans 合法路径且基线 Git 对象存在、边端点存在。刷新应保留这些检查。建议在同一测试补最小数据合同断言：五个视图 ID 唯一且集合精确、合法 kinds/有限数值、group 在画布内、routes 的键确有对应 edge；无需新校验器。卡片相互遮挡、连线穿字、字宽并未被这些 Node 断言证明。

## 2. 刷新时必须有意识重绑的硬编码

| 固定路径/行 | 当前旧锚点 | 最小处理 |
|---|---|---|
| data:2；test:40–41 | aeb764e5…、2026-10-06 日期 | 基线改 owner 实际审核的完整目标 SHA；核验时间用真实时点。测试精确绑定新目标，不改成任意 SHA 即通过。 |
| test:44–56 | 固定路由名单、Thread 组件名、队列跨 reload 尚未完成 | 按新固定源码与后继验收事实逐项更新，保留 runtime/源码/部署的区别。 |
| test:140–143 | knowledge.capture、enqueue(text,capture.knowledge)、send(text,creation,capture.knowledge)、prepare(creation) | 这是旧调用形状；只改变对应新源码锚点与材料语义断言，不能删掉材料冻结检查以求绿。Web 事实由 root 核定。 |
| test:247–248、302–305 | Codex/provider 后继、Web 附件/登录尚未含、native authority/receipt 未接、默认 fixture；modules1375/data1415 | 更新有正式来源的能力文案；尺寸不变则保精确断言，若必须加行，只在数据内调整并重核布局，不借刷新扩 renderer。 |
| test:274；browser:49；data:67 | 正则 `/TUI goal consumer已挂载/` 会匹配数据的“**不等**TUI goal consumer已挂载” | 这是源码可证的证据局限，旧通过不能证明真实挂载。新断言须准确表达正/负事实，避免相反意思共享同一子串；root 提供 TUI 事实。 |
| test:287–289；audit:64、96；data:99 | `sources: context.sources.map` 与 attachment-only min1 不兼容旧缺陷 | 新固定修复若已接，应替换为真实新来源和已验边界；不能要求保留旧 bug 的字符串，也不能只因字符串变化宣称组合行为通过。backend 事实由 panels 核定。 |
| audit:92–96 | browser-session/index.ts 必须 absent、固定020/022/023/024/025/026/027迁移、硬编码 limits | 按新固定对象核存在/未接；不能把所有 Git 错误等同合法 absent。limits 要与图文同批更新，新增迁移只限实际有关来源。 |
| audit:97；browser:11、26–29、42、47–49、59–92、104–107 | snapshot-aeb 输出目录、旧 SHA/源码链接、旧详情文案 | 新运行必须写新的 owner snapshot 证据目录，保旧 raw 不覆盖；browser/source audit 内同批重绑输出与来源，不保留混合旧 source 标签。 |

`source-audit.mjs:5–6,79–90` 导入的是执行 checkout 的 data，但领域源读取 baseline Git 对象；它以第一处 substring 命中记行号，再 SHA256 每个来源。它证明固定文件/文本存在，不执行领域逻辑，不证明真实服务或用户配置。新 candidate 必须同时钉 data/test/audit 的文件 hash 与 `baseline.commit`；只钉 commit 不够。旧 absent/limits/browser 文案不能机械继承。

## 3. 可直接复用的检查与输入限制（均未执行）

1. 原入口仍是 Node24 `node --test apps/execution-dashboard/test/architecture.test.mjs`，静态可见18项。未来结果需记录具体 candidate/hash、18项或明确新增数、0 skip/fail，而非引用旧18/18。该文件即使做 name filter 也会顶层 import server→aggregate→ledger→`pg`；package.json 固定 pg8.23.1，因此不是“只需 Node、完全无第三方解析”。第二项只创建随机 loopback 端口、请求静态资源/拒绝接口并 close，不请求 `/api/snapshot`；源码未见它调用 coordinationPool。保原真实 Host403/POST405/CSP/任意源码404断言，不启动真实4320、不聚合真实 registry。依赖与运行资源由 owner 现有准入解决，不另造 runner。
2. 复用当前 source-audit 算法，在 owner 已领新 snapshot 目录固定其脚本和输出路径。原命令 `node docs/evidence/d06/snapshot-aeb/source-audit.mjs` 会覆盖历史 source-audit.json，**不可原样执行刷新**。这是受控证据脚本最小重绑，不是增设通用框架。
3. 原 snapshot-aeb browser-check 的五视图、Enter/Space、固定链接、label getBBox、zoom、390 双主题、page 横溢与 API 限制断言可复用，但旧 SHA/文案/输出目录必须先修齐；旧启动/预算并不授新执行许可。浏览器 raw 必须对应新候选，旧5view与截图仅历史。

## 4. renderer/CSS 不变时仍要核的布局与文案

renderer:28 将 title/subtitle 作为单行 SVG text 放在 x14、y29/53，卡片恒225×80；CSS:22–23 字号18/13px。没有换行或截断，因此不得按字符数猜能放下；保持短标题/副标题，完整职责、条件、限制写详情（CSS:31–32 已 overflow-wrap:anywhere）。既有 browser:35–36 实测节点文字右缘≤222，适合保留；但不检查组标题/边标签与其他元素重叠。

边标签框宽由 `label.length*8+14` 粗估（renderer:46），不是 glyph 宽；custom routes 亦手写。因此新名称、图层/行位置改变后，仍需实际五图检查卡片/分组/箭头/label 不遮挡，不能仅依据坐标合法。保 group 边界、节点225×80、路线端点和标签位置；不改边语义来规避碰撞。

CSS:10–13,39 与 renderer:49–60 决定窄屏降单列、图内滚动、fit 最小42%；390 下图可以局部滚动，并不要求1120宽全内容无滚动显示。应核 page 不横溢、图内内容可达、详情长链接可换行、双主题与键盘选择/焦点，不把局部滚动误报成失败，也不声称旧短文案截图覆盖新文案。

## 5. 给唯一 owner 的最小实施顺序

先接 root/panels 对新固定目标的领域事实→同步改 data 的 baseline/文案/source 节点（尽量不动坐标）→同一原 architecture.test 更新准确来源锚点、保语义断言→在新 own snapshot 目录沿用原 source-audit/browser 入口并精确重绑→先固定数据/测试/脚本 hashes、确认 renderer/CSS/server/deps 零差→再按独立准入做现有直达与实际图验证。新图只讲固定源码能力，服务部署单引实际 receipt；原18Node/5view不迁移为新 PASS。

技能：已读取并复用本地 find-skills/codebase-design/clean-code，精确路径/hash 见 audit.json；未重新安装。Interface 与消费者对应、最小局部刷新、旧证据不覆盖、错误/unknown 如实保留，是本段实际应用。没有项目改动、没有产品运行。
