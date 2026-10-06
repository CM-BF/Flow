# S01P02 独立review

状态：NOT_STARTED。base4391bbf9f1785212d098ef6aa1c01a0320a003d3；target PENDING_S01P02_TARGET。WT/branch见[status](status.md)。范围为main.ts、纯parser和两测试共4源码；review只读，修复归owner。

```text
只读review S01P02固定target。先核AGENTS/plans规则、实际branch/head/dirty、claim与source manifest。用本地codebase-design/clean-code核规范十进制1..16/default1、A2A仅1、所有非法值先于文件/配置/网络/profile副作用拒绝、native参数传递、signals清理和脱敏错误。检查显式parser+真实main入口mock测试及root strict noEmit证据，不将mock当真实并发。禁止PG/provider/auth/服务/安装及修改共享路径。结论绑定target，报告severity/位置/blocking/未检查项。
```

作者证据：64/64（42 parser+22 main）与root strict局部noEmit0；[manifest](../../docs/evidence/s01p02/source-manifest.json)。独立reviewer/结果/时间：尚无。作者检查不代替独审；部署/真实混合负载不在本片验证范围。验收为plan三项TODO；后继review修复保留claim。
