# 当前后台迁入 Module

固定实现 `7324a2a0b495eb82e64693ec6d1b8781eb12d8c5`，准备范围限定为把已审 cd27/04da 迁入已有 c7b + 7d1 的安装；不变更已选后台、独立 Web host、策略、release pointer 或用户数据。本次没有个人 I/O、复制、PG 或服务操作。正式个人实例参数、报告集合及实际监督调用仍未建立，不能将本 Module 审查当现场执行就绪。

## 小接口和真实装配

`current-migration.mjs` 导入没有执行入口和个人读取。实际调用顺序是：在外层已核固定源码/运行时绑定、一次窗口及新私有 namespace 后，`validateCurrentMigrationInput(input)` → `loadCurrentMigrationModules(input)` → `migrateCurrentArtifact(mod, input, healthy)`。`healthy` 只报告当前有界段是否仍可继续，不授权任何来源或状态。

`loadCurrentMigrationModules` 先用受信新工具完整校验安装内已选 **7d1** manifest，再从 `<installation>/backend-artifacts/<7d1>/root/tools/personal-preview/{preview,process}.mjs` 加载真实 Module；`createRequire(<同 root>/package.json)('pg').Pool` 使用同一产物依赖。不是旧 root 的 null-backend 装配，也不提前从尚未迁入的 cd27 加载。静态 Node 输入及其余固定非 Git runtime 复用原 migration-inputs 的精确 pin；不能用 whole moving main 代替逐文件来源。

| 所有者 | 职责与固定来源 |
| --- | --- |
| 本 Module | 当前 backend7d1/source6c、Web host7d1、已有205B policy、六私有文件/三角色记录、完整旧保留集合及本次 cd27 参数 |
| 原 `migration-adapter.mjs` 5c29 | `migrateWithLocks`、`record`、`confirmMigrationRunner`；preview→store 双锁、原 marker、schema-qualified `flow.runners` 只读单连接及错误/关闭 |
| 原 `procedure.mjs:migrateOnce` | intent→inspect→clone→verify→sync→checkpoint→exclusive publish→sync→verify；失败 unknown，不重试 |
| retention 工具 203ec / main fd9 | 完整 verify 后的实际字节，统一 count4/单项1GiB/合计2GiB；导入不使用最大构建预留来猜实际大小 |
| 原 clone-artifact.py / renameExclusive | 原 file-only CoW 和真实 no-replace；不 fallback/install/build，不覆盖旧目标 |

上述13个静态 Module/driver逐文件 current/Git 相等，原 Node/Python/OPS14/rename Python 四非Git pin也一致，见[单份结果](current-migration-result.json)。`index.mjs` 会静态导入既有 build Module，但本迁入不调用 build；YAML 的动态 build-only 导入不执行。实际安装内7d1的代码和依赖必须在现场完整 manifest 校验后加载，此处未读取个人安装来代替该门。

## 结构化参数与执行前责任

参数必须包含：不同的绝对 installation/source/run/repository 路径及三个目录的 dev/ino；固定 cd27 与7d1/c7b descriptors；已选 source6c/dirty=false、settled host7d1；fresh runner id/accepting/CAS/op=null；config、claude、state、maintenance、web-release、browser-session 六文件 dev/ino/bytes/hash；三 owned-record 摘要；原61227/61228；固定 Python/clone driver/helper；manifest3196606B、15628entries、payload363849010B/总367045616B；fresh/live/增量/raw预算。

未来固定实例必须用授权的 fresh 读取填写身份、六文件 pin、CAS、进程记录和新 namespace，不能从历史13:49原件推导当前值。本段没有建立这些实例值，也没有创建运行目录或预消费许可。身份、权限、hash、未知 stage/store、旧项缺失、非本目标第三项或字节越界均拒绝；已存在精确 cd27 仍全量核验并只记录结果，不自动换 namespace 重做。

实际外层需沿原 `migration-supervise.py` 的 OPS14 单 NEW_CHILD_SESSION 合同绑定本 Module 和新输入，先验静态 closure 再启动 Node。不能原样执行旧 supervisor 的旧硬编码输入。保120s work/.5s TERM/2s reap/raw2MiB，新operator及clone/rename子进程同组，绝不监督个人 detached角色。run根独占0700、outer/输入/结果0600且wx；原健康/时间/字节控制在现场固定薄调用中供给。此调用装配的实例化属于后续固定执行包，当前仅可调用 Module 与参数/guard 已完成。

stage/final 是同份 payload 的原子移动，原私有artifact继续保留。新增512MiB含 allocated copy与raw；逻辑大小不等于独占物理空间。外层全段预算、latest团队floor、live1GiB及所有KEEP资源仍分别核，不把本地检查free当实际准入。锁正常 finally释放，unknown留原记录与stage，不清理个人数据。

## 本次证据与剩余

6个不同例分两轮7次选择：5/5（117ms），补参数拒绝与loader 2/2（127ms）；总244ms/raw1100B，两组absent/双EOF/两exact空scratch正常移除。首轮两个源码经后继增量逆变换后与原raw所记SHA256精确相等，作为明确标注的回收快照保留，不称它们运行前已存盘。第二轮只重测受新增必填校验影响的参数例；先前retention5/5未重跑。真实 Node 能加载本 Module，`pg` CommonJS形态通过**自有 cd27**同源依赖验证，未连接数据库；路径例未加载任何个人 Module。原局部段含retention合计5992ms，0provider。

仍待原 Web owner 对 backend04da/context81a8 的三retained及新页面报告；还需固定报告集、授权fresh个人观察、实例参数、实际OPS14调用及唯一窗口。原旧R1–R4/held/迁入raw均未改变，不重放旧维护或retirement；本片不是新兼容、部署或实际接单通过证据。
