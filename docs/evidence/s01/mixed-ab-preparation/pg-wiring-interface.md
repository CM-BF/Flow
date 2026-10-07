# 观察交付与当前领取协议：消费者接线片

Source `b846778835f3cb6dbb60fa4e8b04f87c504f0813`；段从2026-10-07T12:42:29Z开始，截至13:02:29Z。本片 **SOURCE/LOCAL_RESULT READY FOR REVIEW**，新性能实验 **NOT_READY / NOT_OPEN**。生产baseline仍固定 `4fdd856293a502209d7509ea37da901bbfd89f72`。

## Module / Interface

| 模块 | 实际职责与生命周期 |
| --- | --- |
| `pg-delivery-bridge.ts` | center直接消费原已审delivery；固定mode/epoch，接收phase后用本地单调时钟ACK，sample在settle时标本地phase。恢复observer后finish一次，summary也仅发一次。driver核同epoch/模式/顺序/settle计数与summary；缺失、重复、部分flush均UNKNOWN。 |
| `child.ts` / `driver.ts` | 配置贯穿原launch；center使用bridge，driver只接自己center PID的delivery，并仍在原预算收费完整IPC及归档。driver等待center phase ACK后发同epoch measure，runner拒错epoch并回传同epoch的window-start/end；其本地时间不能跨进程相减。默认未选delivery沿原事件形状。 |
| `channel.ts` / `process.ts` | reporter实际拼出pid/childMs后核完整信封≤64KiB（不是只核module payload）；pending/cumulative原界限保留。send true只表示本地入队，异步失败仍计dropped；opt-in child排空500ms后pending或dropped非零则exit1，driver沿原非零进程结果判UNKNOWN。opt-in子进程沿用自有TMP并禁Node compile cache。 |
| `claim-observation.ts` / child | v2 success先由同一固定生产 `decodeRunnerClaimResponse` 解码，再提取实验身份；旧v1不加载不存在的v2模块。同key同tuple记claim-replay，不重复claim；更换attempt/owner/runner、错误状态或empty回退均实验失败。unavailable只作历史身份，绝不授权adapter；生产FlowClient仍执行自己的真实codec/fence。 |

接口消除两处真实缺口：buffered结果不再被IPC到达的driver phase覆盖，当前`claim-opportunity`/status不再被旧`/claim`观察分支漏掉。`ab-input`只追加一个生产DTO文件定位literal；旧A/B identity、source-input名单、默认参数和所有原raw不变。protocol判断只属于本私有观察器，不新增产品协议或第二状态权威。

## 局部验证与真实限制

[单份段记录](pg-wiring-local.json)保留9个顶层child及各原始receipt/raw。9 distinct分轮：首8选7pass/1fail；pending反例原200B允许两帧，改为150B后仅该1例通过；v2影响2例重验通过；增加实际child错epoch反例后，仅normal/wrong-epoch两个真实idle IPC peer通过（其余7未选）。共3个嵌套idle peer，实际关闭由既有stopProcess/测试断言支持；没有case、runRunner、PG或HTTP服务。不是最后全集9/9，也不与旧11或64相加。

类型首exit2为专用config漏继承本实验已有`@flow/contracts`路径（2诊断258B），继承原mixed config后strict0。后续类型0分别覆盖unavailable拒变与公开decoder动态接缝/runner epoch修正；未放宽严格选项。最终source的实际strict为types-5。旧green没有以新输出覆盖。

9 raw共3436B；supervisor累计12236ms非whole wall，最早child12:48:08.521255Z、最后12:53:22.828271Z；观察与编辑/等待分开。每次fresh≥6895435776B，实际约21.8GB，manager完整声明包括当时REMOVAL/Web/MSG03。9 owned groups最终absent/mergedEOF/完整捕获、9个新TMP同inode有界末样本后删除；早期EPERM和首失败保留，末样本不冒峰值。最早CLOSED消息过早、追加检查后已纠正；peer确认没有并跑，本段终态再归还。无原unknown根访问。

## 明确尚未可运行

新配方必须先取得自己的输出scope/identity、固定完整current-main closure/动态SQL与资源sum；本片没有创建pool-wait-run。`runMixed`新可选delivery参数检查base4fdd与单case，现有所有旧identity均不满足，**在任何输出创建/DB前拒绝**；不能拿旧A/B namespace试新模式。尚缺新recipe/sourceDirectory调用方式、各进程边界在途计数、合成已完成conversation轻读、6秒measurement与最多5秒adapter尾段、四取消和同钟停止证据、258任务总账。它们在后半实施，不以本片注入/idle peer证明当前main全运行链已通过。

16384各kind/4MiB逻辑保留/64KiB信封都是失败边界，不是heap或网络硬cap。旧A/B acquisition约7796/7788有余量不证明新chat/取消尾段足够；实际任何溢出停止并UNKNOWN。一次性buffer flush仍可能遇pending界限，不能静默丢样或无限重试；PG窗口必须验证实际完整输出。

## 质量复核

2026-10-07T12:55:31.777835+00:00，沿本地find-skills、codebase-design、固定clean-code方法（技能来源见前片interface，未安装更新）：只抽同一center/driver delivery接缝与实验claim身份；保原observePg/计时/生产pool/SQL，真正codec归生产包；错误/取消/flush/pending均显式收束；已有OPS14负责监督，无新监督循环。原局部caller仅按本段literal路径/预算调用OPS14，所有记录另名，不重写旧caller/raw。架构变化只在私有实验，不需产品架构图改写；未来完整新run未批准。
