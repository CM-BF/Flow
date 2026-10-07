# CORE operator 环境窄修后的执行边界

本文件覆盖旧pg-window.md中外壳启动命令及manifest选择；其预算/身份/清理规则保持。NOT_OPEN，不能因sentinel通过启动PG。

实际入口由operator以固定外壳环境启动：

`/usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C TZ=UTC /opt/homebrew/opt/python@3.13/bin/python3.13 -I -B docs/evidence/wpf-mature-02-message-settings-core/claim-eligibility/pg-once.py --admission ABSOLUTE_ADMISSION --sha256 EXACT_SHA256`

Python -I/-B拒绝用户site、PYTHONPATH/PYTHONHOME配置并不写bytecode；env -i不继承Node/Git/Python或私有配置变量。caller本身也显式构造git和PG子进程环境：固定PATH/locale/TZ/cache开关，git不读global/system config、禁optional locks；PG仅加入明确owned TMP/cache/window/head/work/cleanup九字段。没有任意额外env字典、USER/HOME、NODE_OPTIONS/NODE_PATH或其它FLOW继承。child同PIDexec Node沿此前受控env传递，不从任务输入授信。

新caller只读取pg-env-manifest.json，旧pg-manifest.json在历史920a保持原字节，不能拿旧hash作新的actual准入。product/test/fixture aa741、两donorhelper、原types/list/local/raw、五case选择、33SQL、唯一run-r1 namespace均不改。尚无actual输出目录或admission。

新普通sentinel仅一次Python纯AST提取actual两个环境函数，人工NODE_OPTIONS(--require/--import)、NODE_PATH/HOME/privateFLOW/DB sentinel被排除；禁止访问真实父env对象，静态核两Launch及execve连接。不import/importlib执行PGcaller、不创建PG/HTTP/SDK/provider。通过只证明环境构造和连接，不证明5case实际PG已运行。
