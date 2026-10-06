# X01 候选研究输入（未作为产品选型）

以下是Goal Owner经Execution Lead交付的固定研究输入；候选已定位，但并非用户已亲自确认所指项目，也不是兼容性/性能验收。本轮不安装Pi/proxy，不执行自更新，不调用模型。CTX01只核固定core包，候选身份不阻塞该零模型实验。

| 候选 | GitHub固定输入 | npm固定输入 | 当前边界 |
| --- | --- | --- | --- |
| billion-context-pi | [f9dc71398100bf1a5b1eca45ec7b482dda47e16d](https://github.com/ranxianglei/billion-context-pi/tree/f9dc71398100bf1a5b1eca45ec7b482dda47e16d) | [0.1.83](https://www.npmjs.com/package/billion-context-pi/v/0.1.83)，gitHead1cb6340d | Pi宿主候选，未安装/未测 |
| billion-context | [f704b43bdbf0b8e668e18936febbd1d247722cf4](https://github.com/ranxianglei/billion-context/tree/f704b43bdbf0b8e668e18936febbd1d247722cf4) | [0.1.185](https://www.npmjs.com/package/billion-context/v/0.1.185)，gitHead42a461cb | proxy/native身份与恢复边界仍待各自验证 |
| acp-kernel | npm gitHead4d38906e；GitHub当前0.0.104必须另列 | [0.0.101](https://www.npmjs.com/package/acp-kernel/v/0.0.101) | CTX01仅固定0.0.101纯core；不混GitHub0.0.104 API |

acp-kernel预期integrity：`sha512-zKqi1mW+oTcpSY79lKkQXdz9AXFrmRj7JL6Mfpuo6JXM0WqRebXHBkQUZz9VGGi1SsOOjK0D9NghZ1/mIakdAA==`。固定包名/完整性/许可/实际入口由CTX01独立核验，本附件不把转述输入当已下载验证。

后续仍要求唯一compression owner、session/lineage、原文精确引用、serialize/restart/fork隔离、未知版本与损坏恢复边界。手写summary与合成sessions不证明语义质量、实际agents容量或账单节省。X01-09完整候选验收未完成；用户现在无需为CTX01作身份决定。
