# 显式自有OpenSSL配置单目标候选

GO已授权准备go-node-owned-openssl-once；实际NOT_OPEN。沿WPF-MATURE-02-03，owner chatui01_owner/gpt-6-astra/co-lead mika。旧failure-text结果/清理已38e78c11封存，原raw/manifest不改。

唯一变化：固定owned-openssl recipe将仓库34B注释配置复制到已允许own control/openssl.cnf（仅注释+换行、无include/engine/provider），同Node argv在--jitless/--no-addons前明确--openssl-config=<own file>。candidate37023e逐字不变，不读用户openssl.cnf，不加grant、不用legacy-provider/不改全局env。固定Node/27依赖/144节点closure/script仍fresh hash/身份核。

一手依据由Mika只读核固定Node v24.20.0：[node_options.cc](https://raw.githubusercontent.com/nodejs/node/v24.20.0/src/node_options.cc)1345–1350注册选项；[node.cc](https://raw.githubusercontent.com/nodejs/node/v24.20.0/src/node.cc)1130–1146在OPENSSL_init_crypto前将非空CLI配置路径优先于OPENSSL_CONF传给OPENSSL_INIT_set_config_filename。仅源码假设，不证明本机成功。

复用runCause/runOwnedCommand、已审private retention与同inode cleanup；不建第二监督器。≤1 immediate-exit Node target/30s含hash到双流/停止/临时根/收据/CLI及outer，1MiB准备+观测+所有磁盘副本/收据/人工archive总额；128KiB archive≥24KiB尾部、16KiB receiptCLI/4KiB outer，stderr≤8KiB。私有副本继续0600保留供独审，失败/unknown停止，无重试。CLI通过必须完整保留/计量/清理且目标精确exit7+stdout0+40B固定hash，观察完整但exit1仍FAIL。实际shell退出仍由外部pre-call/tool-finish UTC收据核。

只新增配置/薄entry/outer/四个fake反例；cause单枚举+一份control文件+一个argv；旧recipe不加配置。声明检查：精确内容/argv/profile/env、旧failure-text不变、写配置失败0target、exit1仍保留文本但拒过。16:36:02首次四fake 4/4 exit0，见[固定验证清单](validation-manifest.json)；raw956B、单worker/native config loader，0诊断目标/监听/PG/provider。Vitest worker/转换属于检查工具，不称所有OS进程为零。专属cache实量150逻辑B/4096分配文件B、同inode核后移除；非volume净回收。六源仍ca6a；原生inert/syntax及完整runtime prepared/input组合尚未形成新批准，本次不追加检查或打开真实目标。

Flow执行宿主Node、Node合成canary、固定Codex native binary是三种角色；当前Codex bootstrap-inspection加载列表没有Homebrew Node/OpenSSL，此Node失败不证明真实Codex失败，也不是所有harness永久前置。真实Codex启动/权限/模型/停止验收仍开放；Claude逐消息设置另线推进。

唯一未来入口（独审+Mika精确OPEN后才一次）：`/bin/sh experiments/codex-app-server-conformance/node-owned-openssl/execute-window.sh --reviewed-node-owned-openssl-window`。本地.gitignore仅私有stderr与outer；不触共享Git。方法沿本地find-skills/clean-code sickn33@bdacd76/codebase-design，保留单一process owner、失败身份与旧默认语义。

本次方法复核沿已读find-skills/clean-code，固定单一runCause/command注入与四直接分支、错误保留和旧recipe兼容；未改源码/策略、无新框架。preflight固定源码和命令先于检查，结果记Vitest306ms与工具0.528518458s不同口径。

Mika本轮独立核validation-manifest SHA7802ae46…e083、9条source/raw及ca6六源字节一致，确认4fake检查PASS；既有静态SOURCE_REVIEW无P1/P2范围保留，**不是runtime preparation APPROVED或实际OPEN**。
