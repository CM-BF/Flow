# CHATUI01 独立审查

状态：**APPROVED**，仅限CHATUI01零模型preparation。固定target `4a442af83faa91b419357ef0036627566e5f85a8`。Reviewer：Mika / gpt-6-astra；时间：2026-10-06 08:58:17 UTC。Owner依据独立只读报告记录结论，不自批。

## Target / scope

Base：7106a35447bf43026ad7b5ad7c25dc530fd0c4f5；固定实现target：4a442af83faa91b419357ef0036627566e5f85a8；review观察metadata HEAD：8eb001f81405f10ec8986e194e5a5aaf3decf9fe clean。worktree、branch、main事实见[status](status.md)。Scope：experiments/stream-ui-acceptance、plans/chatui01-stream-acceptance、docs/evidence/chatui01；不包含产品改动、真实query入口或真实provider能力。

## 独立检查与证据

- 原3c995258范围：6 source/5 canonical raw逐hash，230产品archive文件对7106逐hash，actualApp driver与target匹配；已查看light/390dark截图。除下述P2外无其他阻断项。
- 最终delta：[turn-fix-manifest](../../docs/evidence/chatui01/turn-fix-manifest.json)，SHA256 `1480e55ea5a8ba574a173bcb36c3f3942530b6d7882517762a784b0a9bba3c89`。7 source/6 raw与Git/实际run driver hash全部吻合。
- create和turn均route.fetch，maxRetries0/maxRedirects0；创建回执身份与配置已验证、持久后只允许相同conversation ID的turn。失败锁定，已消费的许可不恢复。
- f80真实网络2个red复现turn隐式重发/非2xx缺口，最终3/3相关network delta绿；actualApp同driver旅程3个增长样本、2次写操作、final一次、Chrome exit0，raw相符。此前f80的9检查保留原target，未声称全部在最终target重跑。
- Reviewer只读源码、hash、raw和截图；**未重跑工程测试**。Owner本次记录approval只改metadata，不改manifest/raw，不工程重测。

## Finding与复审

| ID | Severity | 原Blocking | 场景与影响 | Owner修复 | 最终复审 |
| --- | --- | --- | --- | --- | --- |
| CHATUI01-R1 | P2 | yes | route.continue完成不代表创建receipt已确认，未绑定会话且丢响应可隐式重发turn POST | f80先修创建receipt；4a442af83faa91b419357ef0036627566e5f85a8补全create/turn共同无重试发送、receipt校验/持久与失败锁定 | RESOLVED，Mika 2026-10-06 08:58:17 UTC |

原结论CHANGES_REQUESTED已被本次固定target的APPROVED替代；旧manifest/raw保留历史，不改写失败事实。当前blocking findings：0。

## 结论与限制

批准零模型验收准备片段集成。real live仍NOT_AUTHORIZED，入口未实现；真实task terminal、runner/SDK/provider usage与真实Web部署绑定未由fixture证明。主线集成由Execution Lead另行核实，approval不表示已经集成或运行在个人服务。

## 可复制delta审查范围

如需后续变更，先核实际head/dirty与领取；只读比对相应固定target源码、manifest和新raw。真实query/个人服务不在此许可内，不重复未受影响的产品全suite。修复交owner，结论绑定具体commit。
