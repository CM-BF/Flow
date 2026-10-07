# 本机连接 Interface / 当前源码

固定实现 `1e4eb135d3517cc42aa260cbadccd0cdf001f076`，base `943a66bfa5f71f4a5000ff2674ac1973e85e0353`。源码待独审；所有检查 NOT_RUN。

- `createLocalInstallationProvider(binding)` 接受启动时唯一的 directory/installationId/repository/productOrigin。仅检查固定目录元数据；不读取config。返回冻结非敏感metadata与唯一readOwnerToken方法，所有失败统一安全消息。实际安装repository由operator提供，不推断成此WT。
- `localInstallationFromOptions(args, env)` 仅 `--local-installation` 才消费小型非敏感FLOW_DASHBOARD_LOCAL_INSTALLATION绑定；默认不触文件。JSON聚合模式不启用provider。
- `createLocalAccessHandler(provider?)` 是凭据route唯一HTTP实现。GET投影非敏感数据；主动空POST校验实际peer、Host监听端口、exact Origin、same-origin/cors/customheader。1个并发文件读取，所有成功/错误no-store，无CORS，provider异常不进入旧server error.message。
- descriptor读取上限64KiB+1检测字节，固定目录inode前后复核、0600/singlelink/有效uid/O_NOFOLLOW/O_NONBLOCK、前后size/time变化拒绝。校验安装identity与路径/端口；不返回数据库/runner等字段。目录被替换拒绝；同安装config原子轮换允许。不是对同uid恶意进程的OS隔离。
- 原server仅新增私有options、handler与两静态asset/startup seam；aggregate/registry/app.js不变。local-access.js独立持有瞬时token/generation/AbortController。默认无token；load/reveal/copy显式，hide/close/visibility/pagehide清除；clipboard已交OS的写入无法撤销，真实文案明确。
- 原生dialog使用标签/状态反馈/键盘焦点，现theme tokens与390布局；连接说明一直可见。尚未由浏览器验证。

35个静态展开direct cases只用合成安装/Node built-ins/动态自有HTTP。browser函数实际消费server和public UI，fake token、空snapshot、nativeclipboard成功与显式拒绝分别检查，不访问真实产品链接。外部browser owner负责Chrome/绝对预算/资源；本函数关闭自身context/HTTP并失败保留report。真实启用/个人连接/main/4320部署均另记，不以此源码或fake测试代替。

更新：`08ec1cf4a439dc60d3b96cc0da9d9fd152d690f7` 两说明反馈已修；专用direct实际35/35通过，见 direct-first。上文第一源码checkpoint的NOT_RUN保留为历史，当前browser/安装/部署仍NOT_RUN。
