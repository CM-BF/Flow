# 固定pagesize比较入口（NOT_OPEN）

source `acbb3311ad4a5b35cb8c91527e969da75853dd71`，prepared `674a6aa391eb7dc554a01eef6bcd58ca8a443b43`。C/A/B fde source-review；Mika 18:07:46批准原caller，18:12:25接受acbb会计delta；12distinct分10+2，初次入口0tests保留。此页不批准真实执行。

唯一未来调用（由Mika精确HEAD OPEN后）：

```sh
/bin/sh experiments/codex-app-server-conformance/native-pagesize/execute-window.sh --reviewed-native-pagesize-window
```

宿主为Node24+transform-types、NODE_DISABLE_COMPILE_CACHE=1。只一次existing clang(包括其reported cc1/ld)及两个C目标A→B；无Node synthetic/native Codex/listener/PG/provider。两臂同compiled binary/hash，A=旧37023+共同exacthelper fixture，B仅额外hw.pagesize。C、原profile、stdio/env边界见interface，未增加其他权限。

全局30秒从外部调用前UTC至工具实际exit，包括inputhash、Node import、编译/子阶段、自动证据、清理与CLI。内部performance是辅助。compiler最晚6s/目标最晚22s，slot fsync后再查；timeout夹紧到26s前含750ms强制收束观察，余4s留收尾。未知停止、B NOT_RUN；不重试/新grant。外部tool UTC+1保守界与wall单独记录。

固定12runtime/29prepared，prepared实值131273B，≤262144；33external+Node全noFollow流式hash已核。执行前独立核全部19输出不存在；entry只核11内部输出，因为outer已先预约8文件。固定input与manifest/hash不得换写。

总2MiB计prepared一次、实际compiler接收字节、regular closed-file size samples、所有own可见文件/目录高水值和磁盘副本、32KiB receipts+CLI、8KiB outer、128KiB人工archive。regular不是wire累计；save-temps+verbose核的是可见自有产物及reported命令，不是OS所有写删峰值/PID树证明。最终archive≥24KiB余量才可OPEN。raw compiler/helper stderr/outer只本地0600精确ignore，不Git/console；安全receipt仅hash/size/owned identity/数值report。未知身份/关闭/诊断副本失败保根，明确不自动清理unknown。

当前所有实际编译/目标预约不存在。旧native fcd/7a72已消费，344B原件KEEP；此片独立预算。source安全与pure通过不证明页大小/native根因或账号能力。
