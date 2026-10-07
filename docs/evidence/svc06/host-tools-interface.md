# SVC06 静态宿主工具闭包

本片沿SVC06-03/04。实际 `preview.mjs` 的三角色共用 `backendRuntime.root`，`static-web.mjs` 从该root的 `apps/web/package.json` 向上解析Vite。既有纯backend+tsx闭包不证明Web宿主可运行。

最小Interface保持 `runtimeDependencyPlan(input)` / `prepareRuntimeInstallation(input)`：私有静态来源表仅 `{tsx, ., devDependencies, flow}` 与 `{vite, apps/web, devDependencies, @flow/web}`。每项核声明specifier与固定lock entry一致，保完整peer-qualified version，经原snapshot/optional/平台图遍历；根暂存dependencies纳两项。只把原根tsx从dev移到prod；Web manifest/importer不改，不选择Web workspace/UI依赖。根若另有同名Vite声明拒绝歧义，不按现场猜版本。返回 `hostTools` 来源列表，构建记录保留；外部host/制品descriptor/FSM不改。

原文件/manifest/lock字节恢复规则及过滤命令不变，正式pnpm仍负责布局。下一真实产物须固定含artifact host的新main（本轮只读输入a2e7803161ffb7e2158eaf3c13531448d2a777b0），不能拿不含host的af51作正例。当前Vite spec8.3.2来自该main apps/web/package.json，不升级。解析器yaml2.9.0仍build-only惰性加载，不进入运行依赖。

本段验证仅selector与其staging直接消费者。新固定工具peer/optional与错误来源反例先red，再本模块7项和受影响staging1项；原b218其余检查不重跑。预计tiny fixtures远小于16MiB；累计120s、每命令30s、tmp16MiB、总raw128KiB、fresh2.5GiB/共享保1GiB不降。0安装/clone大集/fullbuild/PG/Chrome/provider/个人服务；真实解析/安装后从apps/web锚解析Vite及静态宿主启动留完整artifact验收，纯选择通过不冒可启动。

方法：复用本地find-skills、codebase-design、clean-code与已授权bounded设计；不安装技能。用单一来源表隐藏工具身份，复用原图遍历与暂存投影，不添加role分支或通用注册框架。源码冻结/交付前再核单一职责、拒绝路径与直接消费者。
