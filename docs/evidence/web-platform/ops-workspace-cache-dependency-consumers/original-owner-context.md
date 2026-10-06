# web-workspace-cache：原 owner 的依赖保留上下文

固定HEAD `10ca8eef12df8dd675ceb61b472778ae529a6201`，原owner workspace_panels_owner。本次只读已知来源，不复采进程/文件占用/空间，不遍历依赖或其他树。

**本组原owner事实：没有为本树依赖安排仍需保留的常驻预览、未结束实验或排定的自动/延迟重放；未另建立将本树node_modules作为其他树donor的链接。** 这仅指我实际发起/持有/已知的工作，不是全局消费者不存在证明。

依据：README:11明确“无常驻新preview，全部实验自有服务已清理”、68.689/90s已停止且不自动重跑；validation:9、33记录每次fixture/browser清理及无新增browser计划；status:19–24、33、37记录固定交付、main接收和停写。status:26的v1 active是当时释放前记录，当前RELEASED来自管理另存回执，不能把旧status当新live核。

实际入口：README:7–8的pnpm/Vitest/类型命令仍依赖安装布局；workspace-retention.test.ts:1依赖vitest。fixture.ts:2、5–6通过同树相对import创建动态context preview，:31关闭定时器和preview，无长期preview自动入口。browser.ts:6–7依赖Playwright/fixture，:47实际创建自有Chrome/fixture，:115–124记录关闭和报告；它是可执行顶层脚本，**本次未import/运行**。旧检查成功仅属于当时完整依赖状态。

| 保留问题 | 本次原owner边界 |
| --- | --- |
| 常驻/未完/已排定consumer | 本组无上述新增保留要求；历史文档清理不代当前kernel事实。 |
| 外部symlink donor | 我未建立/保留此WT为donor的需求；未全树反查，其他Lead或未知外部链接仍UNKNOWN/KEEP。 |
| 未来冻结fixture | 我已准备Recovery next8ed不要求此WT依赖；已知Recovery诊断donor是获准ATTACHI/Flow逐包输入。DPERF/Settings其他冻结包的完整核验由root另做，本段不外推。 |
| 将来重放 | 必须先新批准restore-before-run并验证固定lock、布局、精确依赖和来源，再新准入；不得将未消费旧预算视为许可。 |

**结论保持KEEP_DEPENDENCY_ROOT_PENDING_LAYOUT_AND_CONSUMER_CLOSURE，cleanupAuthorized=false。** Lead独立审计 `/tmp/flow-workspace-cache-dependency-retention-audit.json` SHA256 `a2e51361f131b320aae45f7cfc592a8a2268e7a91f6d66e7b4aef890618ae695`已核字节。该审计给581包/29606 payload CAS匹配；本次只消费摘要，未重验CAS。72 generated shim/layout及root `node_modules/.vite`保留；不可仅凭payload存在CAS就说布局可精确恢复、或移除后当前full node_modules仍可运行。全部源、tests、脚本、规则、计划、own证据、Git、manifest/lock与CAS继续KEEP。未知/全局/未来consumer继续UNKNOWN/KEEP；任何操作只由Lead在其正式精确授权及fresh消费者核下裁决。

复用本地find-skills/clean-code：分离原owner使用事实、Lead物化审计与操作许可，保历史证据；0项目写/claim/服务停止/删除/restore/install/import/tests/PG/HTTP/Chrome/free。

固定blob指纹：

- plans/wpf-workspace-cache/status.md SHA256 5d2c06d40d5c22276b76b280a28a3b3010997d297b699d6c85ad579644e0779a
- docs/evidence/wpf-workspace-cache/README.md SHA256 7cb0b74c62d2672930125ac5bd0e0c45e22287df8703e38c30d110dc6db94da4
- docs/evidence/wpf-workspace-cache/validation.md SHA256 53f7f4bb780342daa8a603ceea869a8d86c87859dce3321cd92407b6d8cccd08
- apps/web/test/workspace-retention.fixture.ts SHA256 d46715af2f97e2441c66ceeee1726bde88438e26211d6de1ad533e273d5a8f1c
- apps/web/test/workspace-retention.browser.ts SHA256 394396d2df48c9fa05df6859c7bae871b69690f3dce9a2be567000383672d8a1
- apps/web/test/workspace-retention.test.ts SHA256 400f819269938c7bbd6ad43749f57d4364cec983cc92557d2e4d9b68022f5e84
