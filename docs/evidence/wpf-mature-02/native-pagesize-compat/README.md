# numeric pagesize compat 固定入口（NOT_OPEN）

source `ebfff8cddf90b7f889e0e6f7b871c245255dcfed`；prepared `9191a93064952fa3134d6a2bb13b1b7a67c496b6`。独立source review 18:26:05无P1/P2；两必要小检查0，旧12不重跑。新包待完整独审与Mika精确OPEN。

唯一未来调用：

```sh
/bin/sh experiments/codex-app-server-conformance/native-pagesize-compat/execute-window.sh --reviewed-native-pagesize-compat-window
```

同byte C/A，B仅hw.pagesize_compat；旧host/command/parser/外部工具链不变。[Interface](interface.md)定义全部预算、错误/清理及unknown边界。1clang及reported后代、至多2 own C targets，总30s从外部调用前到工具实际exit，2MiB含prepared/capture/disk/32KiB收据CLI/8KiBouter/128KiBarchive；人工review/Git时间外、bytes内。编译6s/目标22s/收尾26s边界与750ms原收束保持。

固定12runtime、34prepared=126338B；33external+Node。fresh准入须HEAD clean/claim v6与三scope、输入hash不变、19输出全absent、free≥1107296256B、archive尾余≥24576B。entry自身核11内部输出，outer先预约8项；wx不代替完整preflight。失败/unknown即停、不重试/额外grant。原344B/native和pagesize旧raw KEEP，private仅本片0600/local ignore，不Git/console。

采样完整或负值报告不等于权限成功/native修复。regular尺寸/可见文件高水不是wire或OS写删峰值证明。所有旧输入以historical target解释，当前共享metadata为新阶段快照。
