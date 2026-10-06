# 原生目录兼容页大小许可候选

固定source `fdd7c6c6e23ce94fd400bbc92a8576ec0c315c9f`，准备证据 `3fc337eb7a0c5767699aad0a8e0ed6ccc53e9e58`；[manifest](manifest.json)与[driver input](driver-input.json)固定完整闭包。源码增量已独立审查，组合仍待审，actual NOT_OPEN。

仅原37023 policy追加exact hw.pagesize_compat；不继承C helper exec。原native薄caller/R06六源/loader/catalog/private-text保持不变，所有14 runtime和prepared逐Git/WT/hash，29外部固定文件O_NOFOLLOW流式核验，旧44/52/compat证据按manifest固定历史快照冻结。

唯一未来命令（只有Mika明确绑定执行HEAD OPEN后调用一次）：
```sh
/bin/sh experiments/codex-app-server-conformance/native-catalog-pagesize-compat/execute-window.sh --reviewed-native-catalog-pagesize-compat-window
```

一个固定native，45s含入口hash、host加载、initialize/initialized、最多一次model/list(limit20)、controlled close、所有自动收据/清理/CLI与工具实际exit。外部pre-call/tool-finish UTC加保守秒粒度界，不能用内部before-CLI时间代替shell退出。13输出必须独立fresh全absent；entry只核其中5项，wrapper写8项。fresh claim v6/HEAD clean/输入hash/资源≥1,107,296,256B；不符停止，不临时加权或重试。

总1MiB累计prepared/capture/每磁盘副本/目录/结果CLI/outer及人工归档；prepared去重≤256KiB与archive128KiB互斥，当前archive见固定快照，未来至少24KiB尾部；receipt+CLI32KiB、outer8KiB、stderr8KiB捕获+两磁盘最多24KiB、catalog128KiB。删除不减已计量。人工review/Git在45s外，实际bytes仍归档计量；后续共享metadata按新快照，旧快照不冒称current。raw范围只完整已持久化证据；累计stdout wire和未观测写删峰值unknown。

两owned根全部内容含policy/目录的logical和allocated样本分别≤8MiB，仅启动前/关闭后完整样本；活动250ms只top身份，不是硬配额。未知close/stream/identity保根，不递归删除；private stderr独立0600身份保留直到诊断收束，outer仅stat/hash。旧344B不读不改。0turn/auth/login/个人配置/PG/install/推理调用，网络尝试与计费未经观测；目录不等账号资格/actual模型或全部writer停止。

新检查仅hooks同步后的惰性import和sh-n，两项exit0、0spawn/listener，38B raw；原17分轮行为证据沿旧固定target，不重跑。C compat正差异仅支持此次假设，不证明native成功或旧原因。
