# CHAT06 持久助手正文流

状态：in-progress。Owner：runner_owner / gpt-6-astra。2026-10-06 06:22 UTC。
Base：79d6204e4a5781a7041a1545a7424513feaccdae。Goal Owner已批准有界设计与0模型实施。

正文生成中即可读取已持久的主对话片段，保留工具前的助手文字。通过SDK0.3.290 includePartialMessages，由独立mapper/coalescer→现durable outbox→原fenced报告事务→PG→owner懒读。250ms/8KiB合并、每attempt1MiB；超限明示truncated，无遗漏字节追回承诺。工具/隐藏thinking/子agent不混正文；message_stop不是turn完成。

| TODO ID | 交付与验收 | Owner | 依赖 |
| --- | --- | --- | --- |
| CHAT06-01 | 固定正文patch与轻读取合同、给Web/公共client消费 | runner_owner | 已准边界/合法claim |
| CHAT06-02 | SDK部分帧归属、UTF8合并、完整单块对齐、aborted/supersedes、关闭flush | runner_owner | 01 |
| CHAT06-03 | 022首次升级、fenced事务存储、重复/乱序/限额、owner读与最终结算 | runner_owner | 01 |
| CHAT06-04 | adapter→outbox→真实PG/HTTP；result前正文、ACK恢复、失败取消；局部直接消费者 | runner_owner | 02/03 |
| CHAT06-05 | 独立review、固定证据、main生产接线 | runner_owner / Lead | 04 |
| CHAT06-06 | conversation聚合与Web真正展示，由现owner交接或消费本模块 | Lead / Web | 本片段合同与后续范围授权 |
| CHAT06-07 | REQ15/17后继：测量并改善每patch重读/重哈希prefix的累积O(n²)DB成本，保留完整性拒绝语义；不以wire样例代替容量证据 | 后继owner待派 | 本片段集成及独立范围授权 |

Interface只暴露sealed text patch、轻列表及按块正文。SDK外层uuid只作为帧来源，native message_start ID+block index才是正文归属；缺起点/不能确定顺序不猜。完整assistant每非空块一帧，可先于block_stop，不重复append；工具前多个native message全部保留。aborted/supersedes明示incomplete/superseded，不制造成功。原assistant-final仍唯一最终正文；结算一次，草稿结束展示且历史保留，不追加final造成重复。失败/取消/uncertain保留durable prefix，内存未flush尾段不称可恢复。

测试seam已准：公开coalescer、注入SDK的createClaudeAdapter/runRunner、真实owner/runner HTTP、首次migration。0provider/0云，不跑旧85全套或性能循环，不改工具权限/新agent loop/现服务。Conversations当前他owner领取，本片段不写；exports/client/server mount归Lead。迁移022已预留；scope见回执。

技能：本地find-skills、brainstorming、codebase-design、tdd、clean-code已读用；此架构增量设计已在派工前获准，不重复审批。质量记录和来源在docs/evidence/chat06。新结构需Lead集成点更新架构图，分支不代表部署。

2026-10-06 06:43:03 UTC：Root独立只读批准实现5ff8880b3518992121216998c169dd01ab44cee0，无blocking；原始检查未重跑，进入集成。新增07为明确的非阻断后继，未扩大本次验收。
