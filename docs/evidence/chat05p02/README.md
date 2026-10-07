# CHAT05P02 公开正文接线：固定源码与局部证据

产品 source `1bb025fdf4f6a6a7920b9003ce647a4c2b0dac46`，13个合法产品路径；三共享出口按正式交权后的9816/4fe前像接线。10个经Lead批准的只读输入原样保留，明列于x01-fixed-inputs/c02-fixed-inputs；不将它们算作本片新实现。

局部30个新distinct（client19、host纯5、真实runRunner+合成transport6）与11个旧直接消费者最终分轮通过。三轮focused noEmit0包括真实factory、复用fixture与两项PG测试定义；没有root noEmit或PG实跑。四轮监督累计13818ms、raw7850B，9组最终absent/双EOF，8个scratch正常清理；原失败轮499B缓存按原策略保留为证据。具体时标/逐轮选择与早期unknown观察见local-summary.json和四轮原件。

run03旧deadline检查1红是关闭新功能时额外创建一个timer。源修正为只在显式启用时确认、同一report deadline复用；run04只补失败1+受影响host5与focused类型，不改原断言，不重复已过21。旧红不被最终绿覆盖。

界限：此处“真实runtime”指实际runRunner函数、合成transport与无provider adapter；PG01两项0/2（原失败已封存）。只强制单attempt opt-in，默认legacy；正式CLI/个人部署、Web/TUI呈现、真实provider和聚合容量均未验收。PG准备见pg-entry/README.md；该目录不等于执行许可。

实际PG01的[原结果与限制](pg-run-01/analysis.json)和[绑定清单](pg01-result-manifest.json)保持。第一个错误已从固定store规则定位；第二个500/请求上限前的原因未保存，不能补造。原2case未完成验收，专库/进程/监听器/identified目录清理已确认，缓存132B保留。
