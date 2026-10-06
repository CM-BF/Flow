# CHATUI01 零模型流式UI验收准备

可执行入口：[preflight.mjs](../../../experiments/stream-ui-acceptance/preflight.mjs)。本片产品基线固定7106a35447bf43026ad7b5ad7c25dc530fd0c4f5；实验只新增自身3scope。实现target见[status](../../../plans/chatui01-stream-acceptance/status.md)，独立review尚未完成。

## 已验证

- [最终actualApp HTTP fixture旅程](run-2026-10-06T08-46-06.332Z-8c1e338d/checks.json)：同一focused visible pane、同一草稿ID非空DOM样本9→21→36 bytes，3个样本/2次实际增长。合成服务只在已观察到一帧后追加下一段，模拟provider证据绝不冒充真实provider行为。
- 通过真实UI选择固定none profile；creation guard核requested/model/thinking/tools与profile reference，已接受配置保持一致。一次create、一次turn，未自动展开generic details。
- typed final digest/task/attempt/native session/message与settlement一致；第一草稿被replace，另一superseded块retain且可见；最终正文恰出现一次，无Previous/Next假分支，未发送draft保留。
- final发布时task仍running，这条证据不包含task terminal、真实runner/SDK usage。所有协议数据来自合成HTTP，真实App和协议解析器来自冻结Git archive。
- 专属Chrome正常exit0；退出前持久checkpoint，随后关闭本次Vite/HTTP fixture。Node24.20.0/Playwright1.63.0，动态loopback端口，无个人服务/用户页面/DB操作。
- [6个behavior checks](unit-checks-final.txt)：strict prefix/final拒绝、wx与live拒绝、一次mutation及顺序、未知失败不恢复预算、串行checkpoint与脱敏、错误配置拒绝。没有重跑产品Web全suite。

## 运行

```sh
FLOW_DEPENDENCY_ROOT=/absolute/Flow-with-installed-dependencies /opt/homebrew/opt/node@24/bin/node experiments/stream-ui-acceptance/preflight.mjs --synthetic
/opt/homebrew/opt/node@24/bin/node --test experiments/stream-ui-acceptance/evidence.test.mjs
```

`FLOW_DEPENDENCY_ROOT`仅借用已安装依赖；package.json、锁文件和Web依赖声明必须与冻结产品一致，无安装。产品源码archive写入本scope被忽略的`.runtime`；Vite alias与Node resolve hook把Flow自身代码固定到该副本，运行前后核230项源码hash。源码根不会使用用户正在运行的main Vite。原始运行目录按nonce唯一，reservation wx且fsync，未知不重用。

## 固定证据与边界

[manifest.json](manifest.json)绑定实验source与canonical raw；checks内逐文件SHA记录实际运行源码。初始[探索旅程](run-2026-10-06T08-44-35.740Z-51c56eac/checks.json)及[5项初始行为检查](unit-checks.txt)保留，但不是当前版本通过证据；其未提交driver前态没有完整源码快照，不用于独立复现主张。最终旅程固定代码bytes与实现commit一致。

真实单query仍未授权，执行入口尚未实现。候选见[candidate.md](candidate.md)：需独立新permit和真实部署/source组合，不能沿用O10或把fixture当live通过。
