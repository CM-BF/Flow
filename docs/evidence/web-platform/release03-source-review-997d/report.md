# RELEASE03 997d 独立只读审查

结论：**APPROVED（限定脚本结构与A-only独立入口；0 blocking）**。此结论不等于运行成功、SVC兼容通过或发布授权。固定target、metadata、两源SHA256及当前clean核验见audit.json。无项目写、产品import、types、HTTP、PG、Chrome、provider或服务操作。

- browser:40–63 明确one-run gate，绑定backend/artifact/mode/expiry，累计180s和20s清理预留；唯一run目录禁止覆盖，启动产品import前保存attempt。105先fresh余量准入，147–155每250ms监测free/证据/工作deadline；轮询不是物理硬quota。
- browser:69–77、99–115、173–185 仅生成随机专库，写唯一UUID ownership marker；DROP前核marker且不用FORCE，不确定CREATE/marker不足时保留事实并禁止成功。159–198收集清理错误，hard-stop明确cleanupConfirmed=false且budget未完成。
- browser:89–98、116–146、161–188 监督进程先拥有detached worker/Chrome PGID再等待startup，TERM/KILL仅自身组；检查退出和剩余组，异常不被隐去。A-only在父125拒Chrome请求；worker373–376在任一A失败或history模式直接进入finally，不进入Playwright import/Chrome请求。
- fixture:180–223 每项独立建runner/project/material/conversation并捕捉失败；附件-only与mixed结果各保事实/独立wireRange，browser369–372每项后保存累计history和wire，即首项失败仍记录第二项；不掩盖固定362已知history行为。无provider/SDK调用。
- fixture:35–45保护后端/client/contracts/tools/lock与362字节；63–79验证真实artifact manifest和releaseId，只服务其精确index/assets，无Vite/build/发布pointer。两脚本当前/固定/作者manifest哈希全等。
- browser:199–224只有history+实际App+errors/cleanup均成功且observations存在才import/verify SVC receipt。A-only success允许本次程序正常结束，但result.passed保持false、phaseB=NOT_RUN、compatibilityId=null；不可解读为完整发布绿灯。

## 验证与使用限制

本次未运行生命周期，不能声称PG/child cleanup已实测、历史两项已过或types通过。full mode浏览器部分只做源码控制流核对，没有用旧或未运行截图替代。资源/DB入口仍需管理fresh准入。budget.complete表示该attempt计时完成，实际清理另看cleanup.errors/databaseRemoved/process组；未来准入不能只看complete忽略明确残留。Chrome scratch不是8MiB保留证据口径，运行空间靠余量监测，README已写该限制。只有后续实际A结果和清理原报告能解除其运行状态，A绿也须另批准B。

技能：本地find-skills优先复用现codebase-design与clean-code，审Interface顺序、生命周期所有权、失败封闭与状态归因，无安装/外部实现复制。
