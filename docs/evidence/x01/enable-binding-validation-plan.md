# X01 ade4 分段验证准备（NOT_OPEN）

固定源码 `ade4efa0a332f4f1f1cbcd50012ab8881f41a8dc`；三项P2仅源码关闭，见 [静态审查](enable-binding-static-review.json)。所有测试、类型检查、import、PG、浏览器、安装、构建和provider均未运行。本页不授执行窗口，不产生结果或改写已审源码。

## 可先准备的最小阶段 A

[输入清单](enable-binding-validation-input.json)绑定15个本片源码/测试/034及50个直接TS输入（225,154 logical B），逐字等于ade4 Git和当前树。依赖缺失，只申请 [7个精确ignored链接](enable-binding-dependency-view-request.json)：5个已存在donor、2个本树`@flow` package；供给内容复制0 B、链接target文本752 B（不等于物理占用）。Node24.20.0、TS5.9.3、Vitest4.0.18、zod4.6.5、tar7.5.22及实际CLI/package元数据均有realpath/bytes/SHA。已核定点transitive元数据不称完整Vitest/Vite二进制闭包验证。主树不存在的root zod/tar入口不使用。不得安装、复制依赖或把`@flow`指向main。

依赖operator接收、fresh余量至少1,107,296,256 B、当前claim/source/config/输入绑定与输出缺失核对后，另请Mika开放单个小窗口。拟总30s包含进程启动、检查、own TMP/cache清理、receipt/CLI；stdout+stderr不超过448KiB，tail预留64KiB，全部新raw不超过512KiB，own TMP/cache提议32MiB（准备参数，待supervisor核定）。显式顺序：

1. 固定Node直接执行`node_modules/typescript/bin/tsc --noEmit -p docs/evidence/x01/enable-binding-validation-tsconfig.json`，最多8s；继承根ES2023/strict全部选项，无SDK alias、无lib放宽、不产生build。失败即停止。
2. 同Node执行`node_modules/vitest/vitest.mjs run --config docs/evidence/x01/enable-binding-validation-vitest.config.mjs --configLoader native --reporter=json packages/contracts/src/plugin-runtime.test.ts apps/runner/src/plugins/execution.test.ts`，最多14s。静态计划6+11=17个不同case，实际selected/pass必须从结果记录；0test或skip不能成功。显式单worker/无并行文件。源码禁止自动修改，失败不重试/降断言。
3. 核11个`withPackage`对应真实`/usr/bin/tar` child的close/exit、每个精确临时根清理，以及runner fixture receipt。该组真实prepare/import/invoke自有包，**不是纯fake或0child**；仍0PG/SDK/provider/native runner。失败时保留诊断，unknown资源KEEP。

当前ade4首个真实包只消费`config.prefix`；binding虽有`flag:true`、`count:2`，并未断言包实际收到`'true'`/`'2'`。因此这些17例即使以后全绿，也只证明prefix适配，不证明boolean/integer/enum三种值均已运行核验。后续需在已领execution.test.ts做独立精确断言增量、重绑输入后再验；本准备包保持已审ade4源码冻结，不把该缺口默认为通过。

当前**没有可直接调用的通用supervisor接口**。本组旧CHAT06P03 `check-once.py`含专属red断言、源码修改与旧路径，不能原样运行或用import借用；现X01历史checks是固定结果，不是新入口。最小后继请求是在本evidence范围准备仅监督上述两个精确命令的薄外壳：一个monotonic origin/独立期限、注册own进程组、TERM/KILL后确认leader/group/EOF、创建即登记的同inode TMP/cache、`FLOW_X01_BINDING_CACHE`与TMPDIR统一指own根、有界stream+fixture+receipt总账、排他预约/输出、失败无自动重试。不造共享测试平台，不碰个人node_modules或旧unknown目录。这个外壳尚未编写/获准执行。

## 其后直接消费者与独立资源窗口

- **B：局部类型。** [consumer config](enable-binding-consumer-tsconfig.json)沿实际server/index的Fastify类型augmentation、领域与旧plugin命令、Web审计组件检查；根选项原样。当前7链接不足server/Web真实依赖，须另按这些固定入口准备精确视图，不能alias到主树产品或伪造augmentation。两个审计label先由该类型检查覆盖enum完整性，不为它们重跑整个历史browser旅程。
- **C：专用PG/动态HTTP。** `apps/server/src/plugin-runtime/runtime.test.ts`静态10case（含3真实lease锁屏障）及`apps/server/src/plugins/plugins.test.ts`旧11case为直接影响范围；先分别固定actual选中数及自己的数据库生命周期，再串行运行，不能把21当已通过。复用现545源码/30官方SQL加唯一034，实际createServer动态迁移数组须在窗口前逐核；不复制DDL。包含真实host policy、单revision、旧5kind、事务回滚/replay、旧pin/restart、当前grant/owner/fence与clock_timestamp跨lease。安装来源在此是明确合成terminal DB metadata，不冒称实际下载/runner完成。PG外封套须绑定创建请求/database身份、pool/boss/server关闭、远端0连接后正常DROP及DB absent；不能仅凭pool.end当远端已零。既有fixture尾部失败保留与超时收尾须先固定外壳，不借当前服务恢复启动。
- **D：浏览器。** 现已领脚本的输出已改X01独立排他namespace，原X03不写。当前两个label不单独触发全旅程；后续实际Web enable/binding挂载旅程再复用其有限断言并单独申请Chrome/PG窗口。当前NOT_RUN。

未在本片承诺的集成点保持：operator policy生产注入、v3 current claim能力/旧v2过滤、完整request journal与retained恢复、reconciliation保留binding、实际runRunner/semver bundle/有来源events。静态APPROVED不等于production mount、已加载/可调用或整个X01完成。
