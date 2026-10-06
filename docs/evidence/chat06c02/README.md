# CHAT06C02 公共兼容证据

固定实现 **77f0b152a2be32806b17cc7f8a57d33afc2043b3**。独立worktree从main a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8创建；受控合入已审CHAT06 final1a4c63c84ab7f1cc97bc1f2245ef76929e9f821b，并仅pick公共optional boolean合同86fc3af54eb500d24416121b4f36e701ea9fd3c4。没有改正文流领域实现、公共client/server index、根依赖或现服务。

纯legacy投影只过滤typed assistant-stream reference，原始PG timeline/workspace_feed/patch保留；任务快照、eventPage、workspace采用同一policy，SSE复用eventPage。所有分页位置取未过滤raw rows，因此空页也能前进。GET conversation snapshot逐连接协商：精确单值header、显式挂载选项、022与三个专用route可读才true；默认/未知/重复header均false。创建命令与幂等receipt不改变；GET统一no-store，不覆盖Vary。true是读取协议能力，不代表任意runner/provider一定生成patch。[Interface](interface.md)列最小挂载调用。

## 实际验证

- [checks-final.txt](checks-final.txt)：8/8真实随机PG/动态HTTP，2.293s；包含迁移和routes缺失、default/未知/重复header、连接间隔离、创建ACK/幂等、原文保留/专用读取、stream-only页、关闭SSE后重连、workspace双向游标；全部GET快照分支检查no-store。
- [consumer-final.txt](consumer-final.txt)：原CHAT06直接受影响case **1/1，18未选择**，920ms；不称原19/72重跑。本次批准policy改变使原“公共timeline含typed ref”断言失效，依Lead明确授权在原CHAT06 worktree/原claim只改该断言：HTTP无ref且原PG仍保存typed ref，commit **d9a162738c5c3b3531fc7f5da3a5c0ea1e846e67**，再受控merge本片。此test delta纳本次独立审查，不扩大5ff原批准。
- [typecheck-final.txt](typecheck-final.txt)：tsc exit0；diffcheck通过。
- [cleanup.json](cleanup.json)：自有随机flow_chat06c02_*库剩余0；测试finally关闭自有HTTP/SSE连接及pool后删除该随机库。无flow_c01/i01固定库、用户端口、provider/query调用。

[red.txt](red.txt)保留旧实现首次失败：legacy暴露stream引用、协商不返回true；其中原始duplicate-header测试误用不带Host的raw array引发空HTTP响应/未捕获JSON错误，是测试fixture缺陷而非产品结论，已改为Node原生重复header数组并拒绝非200/解析异常。[checks-first.txt](checks-first.txt)为首次8绿；[typecheck-first.txt](typecheck-first.txt)保留测试error变量unknown错误，修复后最终绿。不删除失败、不把类型错误当行为红。

重跑（固定Node24/pnpm9.15.4/Vitest4.0.18，无新增依赖）：

```sh
pnpm exec vitest run apps/server/src/assistant-stream-compatibility/compatibility.test.ts
pnpm exec vitest run apps/server/src/assistant-stream/stream.test.ts -t 'makes durable root text readable before final through task-bound owner patch and block routes'
pnpm typecheck
```

[manifest.json](manifest.json)绑定7项source（含授权test delta）、固定公共合同依赖与原始证据。assignment_review已独立只读APPROVED77f（[正式记录](../../../plans/chat06c02-stream-compatibility/review.md)），未重跑；main/公共挂载/实际Web消费待Lead；本片没有浏览器或provider验收。协商就绪检查每次显式opt-in增加一条只读SQL（无正文扫描），不是容量测量；通用timeline过滤不授权其他角色读取，现owner鉴权保持。已有CHAT06 prefix校验累计DB读取成本仍是REQ15/17后继，不在本片优化。
