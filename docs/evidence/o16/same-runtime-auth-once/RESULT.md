# 同 runtime 公开认证状态：未检出来源

一次SDK内native2.1.290 `auth status --json`，使用recipe411的新私有HOME/config/tmp及固定三个SDK公开环境补充。白名单为loggedIn=false、authMethod=none、apiProvider=firstParty；subscriptionType未出现，不能填空或猜Pro。

原生exit1/监督CHILD_EXIT_NONZERO保留。固定authStatus源码对loggedIn=false使用exit1，因此本次是明确状态观察，不是认证通过，也不是query成功。原生子段174ms、准备加运行1085ms，分别在10s/120s界内。Node准备787ms、native172ms，两组最终absent/双EOF/无signals；原pre-reap EPERM观察保留。0query/PG/交互认证，原SDK累计3/无第四次。

279B原stdout/stderr只在内存进入已审safe_status，解析后清空；没有保存、hash或输出原文/email/org。仅保留允许字段和受控进程事实。没有直接读取真实HOME/config/Keychain，native正常来源查询不等于其具体来源已经证实。

新私有目录测得427 logicalB/8192 allocatedB、7 entries、2 regular files、无symlink，测量complete；这是有界非原子观察，不是全系统写入或峰值保证。新scratch身份在reservation.json，保持KEEP，未读取其中内容或扩大原empty-only清理规则。旧R3/R2/R1资源不动。

旧2.1.291+真实HOME的loggedIn=true/Pro与此结果不能互相覆盖。当前只能说固定私有recipe的status resolver未识别登录；不能要求用户重新登录，也不能直接认定Keychain拒绝/账户过期。下一步只读具体来源解析差异，任何新的实际auth或query都不是本结果自动授权。

薄caller source dff8e1f8；复用原白名单函数、OPS14、原nativeEnvironmentPolicy和OPS-METER。新增3个白名单直接自检通过、Node syntax0；未重复原旧26/16/7或模型。原始运行结构记录只保一份，准备与实际状态分别记录。
