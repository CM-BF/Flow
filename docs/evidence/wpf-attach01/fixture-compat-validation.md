# Attachment factory fixture compatibility

固定实现 `1f0c1966e3cbfef166c58c4aebb7f1aece8c1da9`；增量base `1d236cbe2299117e3b63887fda3d1c0e140f56b0`，原运行模块8701/78批准与原报告永久保留。此增量仅两个测试源，生产模块与F01入口未修改。完整hash与来源见[manifest](fixture-compat-candidate.json)。

本轮真实执行 `1d236cbe2299117e3b63887fda3d1c0e140f56b0 + dirty`，开始2026-10-06T11:19:18.572799+00:00，结束2026-10-06T11:19:36.307698+00:00；执行前后两源码SHA256相等，随后绑定固定提交，不倒填执行时HEAD。[原日志](fixture-compat-first/direct.log)、[严格types](fixture-compat-first/types.log)、[checks](fixture-compat-first/checks.json)均保留。

- 六个明确选中的PG/HTTP case通过；其余23项由 `-t` 有意未选，不声称29或78重跑。首升级、普通能力/BOM、upload ACK丢失重启、owner鉴权、独占child SIGKILL重启、Send ACK丢失重启。
- 严格Node24/TypeScript5.9.3两入口及传递依赖 `--strict --noUncheckedIndexedAccess` exit0；不称全库types重跑。
- 资源、context、独立upgrade及child四个随机DB均 remaining=[]、connections=0、errors=[]，只动态端口/专用数据库，无provider或个人服务操作。
- 两源码差异 `git diff --check` 为0；metadata完整检查仅原始 `fixture-compat-first/direct.log:13` 末尾空行，原log保留，不称完整diffcheck为0。

## 升级证据的真实层次

新[upgrade断言](fixture-compat-first/resources/upgrade-assertions.json)先显式顺序旧migrations构造1..25，确认026与附件表不存在。没有启动current factory；真实领域函数创建项目/知识、plain和knowledge Send/Queue，能力false，资源cap抛HttpError409。前段是**PG/domain，不是HTTP**；未复制生产auth、未新增public ServerOptions。

原三份receipt、两份context和两份execution input已落DB后才首次调用完整createServer。026新增attachments默认列，原context字段以 `to_jsonb(c)-'attachments'`精确比较；收据和execution行全字段保持。重复migration+server restart保持单一namespace及唯一026。随后通过真实HTTP按原key/body重放plain/knowledge Send和Queue，原v1结构不变；context detail相同，省略/[]仍v1或无context。原assertion含义保留，入口变化明确记录。

该升级test自建/清理数据库，不依赖suite中首test先装026；普通suite beforeAll已安装，任意 `-t` 子集可运行。

## 本次factory事实与待集成项目

本树factory仍固定f181源码。四个首次启动均观察 factoryMigration=false、六route全false，fixture补migration/routes；重启migration=true但六route仍false，仅fixture补route。逐次真实观察在[upgrade](fixture-compat-first/resources/upgrade-factory.json)、[普通资源](fixture-compat-first/resources/resources-factory.json)、[context](fixture-compat-first/resources/context-runtime-factory.json)、[child](fixture-compat-first/resources/crash-center-factory.json)。**没有验证正式自动026/route装载分支**，不能把fallback说成production ready。

`completeFixtureMount`先await app.after排空封装插件，然后检查完整六route；全有必须已有026、全无才显式fallback，部分挂载报错。该分支只为测试兼容，不能修复部分production mount。既有Fastify5.12.5官方本地register.test.js的awaitable register/after用例证明after后仍可注册；不在ready后补注册。后续Lead给正式factory固定SHA时，仅组合上述六case/其正式首启重启upload Send auth检查，不需机械重跑原78。

清理原证据：[资源](fixture-compat-first/resources/resources-cleanup.json)、[context](fixture-compat-first/resources/context-runtime-cleanup.json)、[upgrade](fixture-compat-first/resources/upgrade-cleanup.json)、[child](fixture-compat-first/resources/crash-center-cleanup.json)。cleanup异常仍逐步收集，不强杀未知连接。

## 独立复验

只写自己的输出目录：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH FLOW_ATTACH_EVIDENCE_DIR=/tmp/attach-fixture-independent pnpm exec vitest run apps/server/src/attachments/attachments.test.ts apps/server/src/attachments/context.test.ts -t 'before 026|capability is project-bound|lost upload ACK and restart|owner authentication is reevaluated|committed upload survives|lost Send ACK'
```

严格types完整命令见checks，reader与database安全规则沿[README](README.md)。独立review当前NOT_STARTED；后续归因另记，不改作者raw。
