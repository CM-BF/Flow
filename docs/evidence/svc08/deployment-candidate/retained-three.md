# retained3：明确退役与恢复的最小后继

这是同一 FLOW-001 的只读设计输入，**本次不更改保留策略或删除产物**。当前 af51 `web-release.mjs` 限 3 artifacts / 192MiB；`web-artifact.mjs:89` 另限制 active artifact root 中 3 个物理目录。两种界限必须同时设计，不能只删 pointer 一项就声称可准备第四版。

## 当前可达与未知

保存的 release v3：current d629…，另外 461a… / caa1… 两份 retained。每份都绑定自身 manifest、source 与 af51 compatibility；`loadReleaseAssets` 验完整集合，以 format2 版本 URL 和旧 format1 路径服务。**当前没有单独权威 rollback 选择**；不能自行把“上一项”当用户已选回退版本。下次退役必须显式固定一个要保护的 rollback artifact，并且它不同于待退役项。

已有页面可能稍后请求未加载的 chunk。Vite 明确指出部署后移除旧 assets 可令旧页面 dynamic import 失败；版本化并不消除这个依赖。[Vite load-error handling](https://vite.dev/guide/build#load-error-handling)

`pagehide` 可能不触发，`persisted` 页面也可能从 bfcache 返回。因此页面事件、心跳归零、无请求/安静期或 TTL 都不是“全部旧 tab 已关闭”的证明。[MDN pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event)

`immutable` 描述已有响应在 freshness 期间不变化，并不证明每个客户端已缓存全部 lazy 资源。这是从其语义得出的边界，不新增浏览器缓存保证。[MDN Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)

有限 3 版与无限保活任意旧 tab 无法同时无条件保证。保留全部原资源时继续拒绝第四版；若确需腾出一槽，必须由 owner 明确选择一个非 current/rollback 的版本退役，并接受该版本旧 tab 后续 lazy 请求可能失败。此项选择是未来用户取舍，当前没有请求用户作决定，也没有默认代选。

## 一个有限退役动作，复用既有权威

建议后继 Interface：`retirePreviewWebArtifact({expectedVersion, artifactId, expectedManifestDigest, protectedRollbackArtifactId, decisionId})`。固定 decision 记录具体版本及兼容损失，不接受页面计数充当授权。复用同一 operation.lock、严格 release schema/CAS、verifyWebArtifact/findWebCompatibility 与 commitWebRelease；中心/runner/config 不入变更集合。

先只支持一次移除一个完整 artifact，不泛化 GC。拒 current、protected rollback、非 retained 项、旧版本 CAS、未知/pending 操作或无法保留恢复字节的情形。为释放 active-root 物理槽，建议有限可逆归档而非删除：仅一个待退役 artifact（单产物既有≤64MiB）及其 manifest/兼容报告转入单槽私有 archive；archive 已占且未明确处置则拒绝，不以增加隐藏无界目录绕过原容量。这个额外恢复存储预算只是方案，尚未授权或实现。

顺序：持久 intent/旧新 pointer/精确 artifact bindings → 使用受管 Web-only 生命周期确认旧 Web 已停止且组 absent → pointer CAS 排除该 artifact → 同锁将 exact active-root 目录移入同卷 exclusive archive → 复用受管 Web 启动/ready → 持久完成。这样以有限 Web 中断避开旧 snapshot 与正在读取文件的竞态，不新增热重载确认协议；center/runner 不停止。这依赖前一宿主替换片段的内部锁内 helper，不能嵌套调用会再取锁的公开入口。各步保持父目录持久化与身份检查；跨卷、目标存在、变化或 unknown 不继续。未知 Web 停止不能移动产物；已停后 pointer/move 结果不明则保留精确阶段，不能凭新旧目录存在自行重启。

退役 namespace 后不回退为新版本 SPA/资源。优先沿现 unknown versioned URL 的拒绝语义，不为文案另加 runtime FSM。明确记录旧页面需要用户重新载入后才能切新资源；不操纵用户 tab、不自动丢草稿。若需要显示专门 410 提示，应单独证明它优于现拒绝行为才追加 static-web scope。

恢复必须先验证 archive 字节/权限/兼容，确认 active 槽与总量允许，将同一内容安全回置（已有目标不覆盖），然后用**当前** pointer CAS 恢复原 namespace。不得覆盖新 current，也不能重放旧 pointer；若第四版已占满 active 槽，恢复继续拒绝，需明确另选退役或切换方案。任何 rename/CAS ACK 丢失先观察 durable intent 和两端 exact identity；记录 partial/unknown，不能自动重做或物理 prune。首次产品片不提供永久删除。

## 后继最窄模块范围与验证

待 owner 协调的产品 literal：

- `tools/personal-preview/web-release.mjs`、`tools/personal-preview/web-release.test.mjs`：有限集合、current/rollback/CAS、合法 namespace 与恢复关系；仍单一 release 权威。
- `tools/personal-preview/web-artifact.mjs`、`tools/personal-preview/web-artifact.test.mjs`：exact artifact 私有单槽归档/恢复与现物理 cap；不加入任意路径清理器。
- `tools/personal-preview/preview.mjs`、`tools/personal-preview/preview.test.mjs`、`tools/personal-preview/cli.mjs`：现锁内组合、严格入口、错误/unknown；复用已有领域，SVC06 现持这些范围。
- 独立后继自有 plan/evidence，由 Lead 定 ID/owner 并 fresh take；本次没有领取这些产品文件。

局部验收应覆盖：current/rollback 禁退、3→2 指针与目录一致、旧 namespace 拒绝/其余 lazy 可读、2→3 准备不超界、归档/指针之间故障、restore 不覆盖、满槽恢复拒绝、原 v1 descriptor兼容；使用自有合成文件与现锁直接 consumer。真实旧 tab/公开 Web 仍需独立场景，不能以文件单测冒充。暂无任何新运行结果。
