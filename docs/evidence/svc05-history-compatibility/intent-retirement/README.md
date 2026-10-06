# 一次旧本地 intent 退役：准备待独立审查

固定执行源 `0a8dd95bae123b3c749d859a42c2357e65321bcf`。这次准备使已批准的旧本地未知意图能够在维护屏障与旧runner整组停止后被明确退役；它不会制造原claim回执或重新受理任务。**尚未执行任何个人维护/停止/journal写入/新版本发布。**

[Interface](interface.md)、[逐步输入](execution-inputs.json)、[固定步骤](steps.md)、[manifest](fixed-manifest.json)为本次交付。普通idle gate不改。唯一额外保留差异为精确journal80→46B与0600私有备份/意图/审计；全部四历史原字节与其余保留规则不变。不能依据不匹配现场重基准。前置observer与write所需维护身份分离，未伪造未来operation。

GO由Execution Lead转达批准a7d提案1–5的这一次显式退役语义；这是沿用户已有受控发布授权的预算/边界分配，并非用户新发指令。Lead仍须独审固定实现、核实际输入并开启准确af51 checkout与串行窗口；没有本次个人permit/request。已有2030/2040两次只读失败永久保留，后续材料/维护/服务动作均0。

检查为分轮 **18不同局部用例**：checks-1原9；checks-final因新增guard/真实审计持久化重新跑11（9重复+2新）；checks-seam新5 Node+2 Python。不是单次18/18，不重跑旧产品/网页/PG/旧8发布用例。最终11/11 whole519ms、临时峰值2139B；新增7/7 whole364ms、纯文件原件156B，所有test进程组已退出。原checks-1仅stdout记录合成checkpoint，不能声称它在删除前已持久；checks-final与seam filecase真正fsync checkpoint后校验目录身份并清理。Python只写可重建合成deadline标记，无业务原件。

随后checks-entry固定5段实际Node入口只语法解析0+2 Python AST，180ms；没有执行其中的host/hold/retire。新完整host和hold停止接缝只源码/语法，真实PG锁序、唯一deployment、runner停止与发布保持NOT_RUN。故障注入模拟备份/审计抛错，不声称真实掉电或永久磁盘故障。旧两个个人失败/raw均未覆盖。

新11检查于125352源；最终源将只读文件校验与mutation维护字段拆开，文件提交顺序保持。7新检查于72fde源覆盖该拆分、六阶段与总deadline；其后0a8仅新增observeHost返回后固定config/state hash拒绝与固定逐步命令，未改该纯比较/文件绑定行为。原11未重复。原strict sampler、preservation、center recovery supervisor及产品工具原字节绑定保留。

`window.run_step`一次创建drain时标，每步从同一个900秒扣除，剩余不足2秒不启动；原supervisor负责operator PID期限（不向服务组发信号）。所有实际服务阶段处于子进程期限内，仍不声称OS fsync硬中断或自动恢复未知。每步必须exclusive intent、原始result持久并人工/已审比较确认后才后继，无自动执行循环。

2026-10-06 21:11 UTC clean-code/codebase-design复核：退役Module只持本地字节提交，真实host确认在单Adapter；baseline采样与hold授权职责分开，复用原maintenance/ownedProcess/observer/compare/supervisor，无第二调度/恢复FSM。未发现作者新增阻断，但不代替独立review。技能沿既有本地find-skills→codebase-design/clean-code，不安装或网络研究。
