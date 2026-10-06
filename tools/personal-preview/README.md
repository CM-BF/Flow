# 个人常驻预览

这个本地入口复用现有 center、native runner 和产品 Vite Web。没有预热、示例提交或自动模型调用。依赖 Node24.20+、项目已安装的依赖、本机 PostgreSQL，以及 macOS/POSIX 的 `ps`、`lsof`、`git`；当前实测 macOS，不声明 Windows 支持。

## 使用

先由操作方在当前终端安全提供 `FLOW_PREVIEW_ADMIN_URL`，指向本机 `127.0.0.1` 的 `postgres` 管理库；账户需要创建数据库权限。不要把连接串作为命令参数、写入Git或发到聊天中。首次目录必须不存在，父目录已存在且在所有Git工作树之外；入口创建0700目录及0600配置。

```sh
node tools/personal-preview/cli.mjs start --directory "$HOME/.flow-personal"
node tools/personal-preview/cli.mjs status --directory "$HOME/.flow-personal"
node tools/personal-preview/cli.mjs stop --directory "$HOME/.flow-personal"
```

返回新 `webUrl` 与 `center.url`，不输出owner/runner token。使用产品Web的连接表单；owner token只在本机私有 `credentialsFile` 的 `ownerToken` 字段，由操作方读取并输入。它不在URL、前端构建变量或工具输出里。不要替换原fixture或工程dashboard地址。

初次随机创建 `flow_preview_<随机值>` 数据库和持有标记；已存在库必须与本目录installation ID/实际路径一致，不接管其他数据。后续无须再次提供管理连接，它保存在0600文件里。启动器不读取或复制SDK登录文件，native SDK在用户真正提交任务后使用自己的合法认证来源。

停止保留数据库、任务/对话、native工作目录与配置。重新启动先核数据库和runner凭据身份。若存在 queued/running/waiting/cancel_requested/uncertain 等非终态任务，先返回 `PENDING_WORK_REQUIRES_CONFIRMATION`；操作方核对这些历史工作后，才可显式执行：

```sh
node tools/personal-preview/cli.mjs start --directory "$HOME/.flow-personal" --confirm-pending
```

这仅允许原有合法队列继续；不解除uncertain、不改变owner fence、不重派任务、不证明外部副作用已停止。没有安全依据时保留停止状态并走中心核对命令。

## 固定配置与状态

默认 `claude-sonnet-5-5`，每query最多2 turns、$0.20、60秒，tools为空、不读取材料、请求thinking disabled。是配置限制，不是整个Flow或账户总预算保证；SDK实际报告和未知事实仍按CHAT02区分。配置文件被扩大或改变时拒绝启动，不偷偷升级权限。变更配置/runner身份属于后续显式管理工作。

`configured`与已发布`profile`表示已配置；`provider: not-probed`始终明确没有探测provider。`processes`只描述本工具持有的进程身份，`center.reachable`在核对监听进程组之后检查；`work.lastTaskSucceededAt`/`lastHeartbeatAt`是数据库已记录事实，不是当前在线承诺。`sourceAtStart`记录实际启动源码HEAD和当时dirty布尔值，不随每次status刷新伪装成最新部署。

## 持有、失败与停止

CLI结束后服务仍在独占进程组运行。每次停止前核PID、开始时间、完整命令、随机启动标记及PGID；仅向匹配的组发送TERM。每组最多等5秒，无SIGKILL、无扫端口杀进程。超时或身份不明返回unknown，保留记录供核对；进程退出不等于业务成功或外部副作用撤回。

启动健康检查还核监听者PGID，防已占用端口被误认为自己的center/Web。发送owner凭据前重新核对center监听归属。私有child入口要求当前state中的PID/nonce匹配，不能作为绕过start检查的另一启动命令。

每个角色从系统允许清单建立环境，不继承任意Flow/DB变量：仅center获得专库连接与owner token，仅runner获得自己的token/明确provider认证环境，Web只获得center地址。外层服务wrapper同样先过滤；凭据保存在0600文件中，不使用命令参数。runner内部传给SDK的环境是另一个产品边界，须消费相应adapter隔离修复后再启动用户服务。

原始子进程stdout/stderr全部丢弃；只保留有界的三个exit事实文件和state，不把未知内容或凭据写进日志。启动过程失败会尝试停止已确认身份的自有组，未知状态保留。操作锁没有超时抢占；若CLI崩溃留下operation.lock或首建数据库/标记未完成，须人工核对持有记录，不自动清锁、接管库或删除数据。本工具是同机合作管理，不是OS强隔离，也不管理脱离记录进程组的外部副作用。

## 本片段验证

```sh
node --test tools/personal-preview/environment.test.mjs tools/personal-preview/process.test.mjs tools/personal-preview/preview.test.mjs
```

测试仅随机专库、动态端口和独占临时目录，先核持有标记再清理。真实复用server/main、runner/main和Vite；8个公开行为检查包含CLI退出后服务保留、配置发布、0任务启动、角色环境隔离、私密输出、pending确认、数据库身份、端口冲突、错误PID身份与TERM超时。唯一排队fixture故意不被Claude-only runner领取，0模型/0云。此验证不替代真实聊天、浏览器验收或用户常驻部署。
