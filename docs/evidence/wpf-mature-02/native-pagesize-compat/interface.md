# 固定 numeric pagesize 许可对照（准备中，NOT_OPEN）

本片沿WPF-MATURE-02-03，由GO授权最多一次既有clang编译与两个自有C目标，统一30秒/2MiB；Mika在固定输入独审后命名OPEN。旧hw.pagesize窗口已消费并按000f17cf封存，本片不改旧source/raw/input/manifest。

[Apple固定XNU f6217f891ac0bb64f3d375211650a4c1ff8ca1ea](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/kern/kern_mib.c#L992)将数字HW_PAGESIZE注册为pagesize_compat/INT/MASKED；902行的pagesize是OID_AUTO/QUAD。这里只支持命名差异假设，不证明安装内核与此源码一致或原Codex失败原因。

A与旧baseline.sb完全同字节：原37023 profile加共同exact own helper exec/read/map。B与旧B相比只把唯一sysctl-name改为hw.pagesize_compat；A→B唯一新增许可为该key读取。C、数字MIB、nonce/PID协议、regular stdio、六个target/compiler环境变量及旧Mach/network/Keychain/home/fork限制不变。没有Rust/native重试、模型、登录、PG或安装。

新entry/outer只固定独立window与source/evidence路径。entry直接import旧native-pagesize/host.mjs，继续同runOwnedCommand/compilerInventory/retainPrivateText；没有第二监督器或host副本。19输出独立且必须fresh全不存在；entry单独检查11内部输出，outer先预约8项。已消费slot不重用，失败/unknown停批，未到槽NOT_RUN。

30秒从外部调用前至工具实际退出，包含Node import/hash、一次clang及其reported子命令、A/B、自动证据/清理/CLI。编译最晚6秒、目标最晚22秒，slot fsync后再查；26秒前收束预留750ms与4秒清理。2MiB含prepared≤256KiB、实际捕获+磁盘复制、32KiB receipt/CLI、8KiB outer、128KiB archive，OPEN前archive尾余≥24KiB。人工review/Git在时钟外但bytes入账。regular尺寸与可见文件高水只作采样，不声称wire/全OS写删峰值。private原流0600/local ignore/KEEP待独审，不console或Git。

负读取仍是合法完整观测；比较结果和native修复/账号资格分开。原host12distinct纯检查与bb818实际收口作为历史输入，不重跑；只核新路径/唯一policy delta、惰性import和shell语法。本片当前0compile/0helpers。
