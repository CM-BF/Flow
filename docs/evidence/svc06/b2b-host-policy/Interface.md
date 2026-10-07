# SVC06：固定 b2b 自有宿主、迁移与浏览器策略

状态：PREPARATION / NOT_RUN。仅 claim v7 的 SVC06 plan/evidence；不修改产品、不读写个人安装、不重复构建/import。固定新产物 c2c695e7… / source b2b5612b2a63106ad0e674ddf12b2e8f96cf3388，来源 Flow；旧 factory 固定 af51c621696230fbced12227670f014ca73bd8a1。旧 e5、c7b、失败运行根与所有 UNKNOWN 原件保留。

## 真实职责与复用

| Module | Interface / 状态所有者 | 本次证据 |
| --- | --- | --- |
| 原 af51 createServer | 自有新库、owner token；正常 close 后才交新 factory | 经公开 API 建一条会话与用户 turn，立即取消该唯一 fixture task；无 runner、无模型、无用户任务 |
| 固定 c2c 的 preview / maintenance-host | 原私有 config/state、原 nonce / owned groups、原 drain→hold→refresh→resume；不复制 FSM | 默认缺配置→三真实角色；同产物正常刷新启用策略；原 runner 身份与历史保持 |
| 固定 browser-session / static-web | 独立动态 loopback origin、私有策略固定身份/hash、默认 off、cookie/CSRF | 实际 HTTP，不调用浏览器或 SDK；只记录状态码/布尔/非秘密身份，不输出 cookie/token |
| 原 artifact verifier / file-only clone | c2c 完整 manifest、同卷新 root、无目录外 symlink；复制后全核 | 不重构建/安装；逻辑/allocated/卷free分开，CoW不称免费 |
| 原 OPS14 + process / fixture-cleanup | 一个 work group、一个独立 cleanup owner；detached service只用原record停止 | primary与cleanup分别保留；marker/OID/有限零连接后 normal DROP；unknown KEEP |

## 一次程序顺序

1. 新 exclusive 0700 root/run，fresh claim/source/输入/可用量；固定 c2c CoW 副本逐 manifest 验证，复制自有 d629 资产原件。原 artifact/root 不写。
2. 新 `flow_preview_<24hex>` 库，先持久 create intent、OID与安装 marker。真实 af51 factory 使用新随机 owner token，公开 API 创建会话、一个 turn、同 key/body 重放；立即取消这一自有 queued task，确认为 cancelled且无attempt，再正常关闭旧 factory。保存其实际27迁移集合、代表记录的原列/逐行摘要与公开ID。不会把取消当成功assistant历史；代表样本限一条已取消用户turn及其关联事件/命令。
3. 通过 c2c 原 `startPreviewServices`（无 preloader / spawn 替换）启动实际 center→runner→Web。新 center 的实际 factory 自动迁移，不手工挂route/补SQL。33是产物SQL文件数，DB预期版本1..35（含内联1/3与035）；核新迁移集合含028/032/033、旧集合保留；旧记录原列摘要不变；默认 `/api/browser-session` unsupported；Web真实静态资产/identity/proxy与runner注册可见。开始 runner 前再次核全库无未完任务，之后不创建任务。
4. 私有根中的**仅本次 loader 合同 fixture**提供旧 v1 pointer/report；该材料只为进入真实维护路径，不能证明 d629 App 行为。非法 browser policy 必须在 bootstrap/drain 前拒绝，原进程/维护状态不变。合法独立动态origin策略但缺v2报告也在stop前拒绝，原失败分别记录。
5. 在 `NON_PRODUCTION_LOADER_FIXTURE` 明示范围下生成同 context 的 v2 合同材料，原 pointer bytes不改，既有受信loader实际查新tuple；材料仅在本次自有根内导入。**它不进入真实三App报告包、个人迁入、发布候选，也不被表述为真实App兼容。** 实际 public HTTP 的会话、cookie、CSRF事实另录，与四份合同check分离。
6. 原维护 bootstrap→fresh active/uncertain0→refresh→ready-paused→显式resume同op；每步成功才后继，旧三组须正常stopped，新三组owned。策略在prepare与runService均原路径复核。验证policy后cookie登录、凭cookie读历史、无CSRF拒绝、合法logout与旧cookie失效；不发送新任务、不调用provider。config/token/runner/profile、release bytes、代表历史均保持，维护版本/审计与browser session新增属于预声明变化。
7. 独立cleanup从原state与已存旧代记录核所有已知组，原 helper正常TERM，无force或按PID猜杀。独立cleanup先持久绑定本run/input的实际work Report终态；仅newChildSession组明确absent才允许DROP。work unknown/异常即使瞬时零连接也KEEP数据库。确认旧factory/组都退出、marker/OID相等、有限3秒查询返回且结束仍未超deadline的零连接后先checkpoint再 normal DROP。保留新root/artifact/私有诊断、所有失败原件；unknown不删除、不重跑。

## 有界输入与运行

拟 work 180秒（含copy/旧factory/两代三角色及正常旧代关闭）+独立cleanup30秒；OPS14原 .5秒TERM+2秒reap分别适用。此为本新旅程待审预算，不沿用旧120秒声称覆盖。raw总2MiB，私有运行64MiB，专库96MiB，artifact副本按512MiB规划，合计674MiB（另2MiB raw，合676MiB）；fresh取原2.5GiB与合计+1GiB更大者，再叠加当时跨组并发。live1GiB；500ms与最终私有sample、阶段DB大小sample仅观测，不宣称硬预留或独占物理峰值。只有固定输入独审及实际共享窗口后执行。

端口动态分配且明确拒绝61227/61228，旧factory使用同一自有center端口但须先close。工作group超时会结束其内旧factory；detached真实服务另由cleanup依据原nonce身份处理。所有旧代记录与当前state均参与cleanup；出现未捕获pending身份不升格为owned，不以work group absent冒detached全停。

## 已知不覆盖

不证明新/旧真实App完整交互、三个个人retained兼容、第四App发布、浏览器UI、默认CLI升级选择或个人服务可采用。此旅程不再重做开发checkout拒读实验；此前e5实验结论保持自己的范围。真实三App→b2b与个人61228 policy tuple由Web owner另交，独立动态origin的测试context绝不复用为个人context。无隐藏thinking、凭据搬运、附件生命周期或第二scheduler。

## 方法

沿已安装 find-skills→brainstorming（bounded、已有Lead明确授权）、codebase-design和clean-code；复用已审工具而非复制状态机。技能路径 `/Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,clean-code}/SKILL.md`；来源版本沿项目既有固定基线，不安装更新。准备安全点复核命名、单一职责、取消/unknown、primary/cleanup、时限与动态SQL闭包。新增行为仅本次fixture顺序；既有绿色build/import、宿主sandbox局部例与产品44例不重跑。

历史摘要只比较五张代表表原有列，明确排除正常队列观察 `queue_checked_at`，原完整旧列/摘要保存；新增列另由实际迁移集合证明，不称全库零变。
