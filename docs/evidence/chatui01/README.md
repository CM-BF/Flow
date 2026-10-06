# CHATUI01 零模型流式UI验收准备

可执行入口：[preflight.mjs](../../../experiments/stream-ui-acceptance/preflight.mjs)。本片产品基线固定7106a35447bf43026ad7b5ad7c25dc530fd0c4f5；实验只新增自身3scope。实现target见[status](../../../plans/chatui01-stream-acceptance/status.md)，独立review APPROVED `4a442af83faa91b419357ef0036627566e5f85a8`（Mika/gpt-6-astra，2026-10-06 08:58:17 UTC），仅限零模型准备；待主线集成。

## 已验证

- [最终actualApp HTTP fixture旅程](run-2026-10-06T08-53-51.835Z-910d72a6/checks.json)：同一focused visible pane、同一草稿ID非空DOM样本9→21→36 bytes，3个样本/2次实际增长。合成服务只在已观察到一帧后追加下一段，模拟provider证据绝不冒充真实provider行为。
- 通过真实UI选择固定none profile；creation guard核requested/model/thinking/tools与profile reference，已接受配置保持一致。一次create、一次turn，未自动展开generic details。
- typed final digest/task/attempt/native session/message与settlement一致；第一草稿被replace，另一superseded块retain且可见；最终正文恰出现一次，无Previous/Next假分支，未发送draft保留。
- final发布时task仍running，这条证据不包含task terminal、真实runner/SDK usage。所有协议数据来自合成HTTP，真实App和协议解析器来自冻结Git archive。
- 专属Chrome正常exit0；退出前持久checkpoint，随后关闭本次Vite/HTTP fixture。Node24.20.0/Playwright1.63.0，动态loopback端口，无个人服务/用户页面/DB操作。
- [9个behavior/network checks](guard-fix-checks.txt)：strict prefix/final拒绝、wx与live拒绝、一次mutation及顺序、串行checkpoint与脱敏、错误配置拒绝；5条真实Chrome/HTTP检查覆盖响应丢失、503、坏JSON、错profile和成功receipt绑定后拒绝其他会话。没有重跑产品Web全suite。

## 运行

```sh
FLOW_DEPENDENCY_ROOT=/absolute/Flow-with-installed-dependencies /opt/homebrew/opt/node@24/bin/node experiments/stream-ui-acceptance/preflight.mjs --synthetic
/opt/homebrew/opt/node@24/bin/node --test experiments/stream-ui-acceptance/evidence.test.mjs
```

`FLOW_DEPENDENCY_ROOT`仅借用已安装依赖；package.json、锁文件和Web依赖声明必须与冻结产品一致，无安装。产品源码archive写入本scope被忽略的`.runtime`；Vite alias与Node resolve hook把Flow自身代码固定到该副本，运行前后核230项源码hash。源码根不会使用用户正在运行的main Vite。原始运行目录按nonce唯一，reservation wx且fsync，未知不重用。

## 固定证据与边界

[turn-fix-manifest.json](turn-fix-manifest.json)绑定完整P2修复后的实验source与canonical raw；[第一段修复manifest](guard-fix-manifest.json)保留其9项检查范围；[原manifest](manifest.json)保留原target与证据；checks内逐文件SHA记录实际运行源码。初始[探索旅程](run-2026-10-06T08-44-35.740Z-51c56eac/checks.json)及[5项初始行为检查](unit-checks.txt)保留，但不是当前版本通过证据；其未提交driver前态没有完整源码快照，不用于独立复现主张。最终旅程固定代码bytes与实现commit一致。

真实单query仍未授权，执行入口尚未实现。候选见[candidate.md](candidate.md)：需独立新permit和真实部署/source组合，不能沿用O10或把fixture当live通过。

## 独立review修复

原3c995258仅creation receipt guard存在P2：route.continue先返回并不证明响应成功，而且首turn未绑定创建会话。[真实网络红证据](guard-network-red.txt)5/5复现。修复target f80fb6606fbcba942fc8741f56b2f2c6f285f2df：create仅route.fetch一次、maxRetries0/maxRedirects0；校验fresh receipt身份、配置与revision，checkpoint后绑定turn，unknown/non2xx/bad receipt锁死全部后续mutation。没有再次发create补证。

旧两个弱mock被5个真实网络场景替代；旧日志和旧manifest保留。该轮9项检查与一条actualApp直接消费者通过，后续同P2补全见下文。产品230文件与Web全suite不重复review，不新增live入口。

复审补全同一P2：第一段f80仍让turn走route.continue，真实丢响应[2条红证据](turn-network-red.txt)证明浏览器隐式重发（总POST3而非2）。完整修复target 4a442af83faa91b419357ef0036627566e5f85a8统一create/turn为maxRetries0/maxRedirects0 route.fetch，并校验turn receipt身份/编号/正文，先持久后fulfill。未知或非2xx锁死后继，不恢复预算。

本次仅[3条受影响网络检查](turn-fix-checks.txt)通过（2新故障＋1已有身份正常路径），并复跑1条actualApp。此前9项检查绑定f80，不声称全部在4a442重跑；合计独特行为11项，重叠项不另加。旧manifest/raw完整保留，独立delta review已APPROVED 4a442af83faa91b419357ef0036627566e5f85a8（2026-10-06 08:58:17 UTC）。

## 最终独立结论

Mika/gpt-6-astra只读复审批准4a442af83faa91b419357ef0036627566e5f85a8的零模型preparation，原P2已完整关闭；未重跑工程测试。7 source/6 raw、actualApp driver/source hash、3增长样本/2写操作/final一次/Chrome exit0均核对。此前9检查保持f80边界。真实live入口仍未实现、NOT_AUTHORIZED；领取保留至主线接收，未把approval记为已集成。

2026-10-06 08:58 UTC clean-code安全停点：仅核review/status/README事实一致、命名、链接和交付边界，无代码/接口变化，无新增工程测试。
