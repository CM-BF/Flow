# 同一维护操作的精确 intent 续接

范围：只处置已在13:22:52观察并绑定的80B v1 intent。GO已允许保留原queued任务和队列，通过完整因果证据确认本intent没有未核清派出执行/副作用后，沿既有锁、备份、提交primitive处置；这是新条件授权，未消费。R4原claim结果仍UNKNOWN，不补ACK、不重投，不重放R2四阶段和R4 bootstrap。

## 确认合同与实际生产者

旧 `retireIntent` 默认规则仍要求pendingTasks=0/pendingQueue=0。新请求显式 `flow.intent-preserved-queued.v2`：绑定R4原 `history-before.json` SHA和原attempts/tasks/conversation_queue全部旧列，不删列或重新建立基线。真实 `withHostFence` 在持久maintenance/v20与同runner `FOR UPDATE` 内读取全部三表row hashes（含completed attempts），核sorted完整行集合的原count/digest；保留唯一queued/current_attempt=null元组和完整promoted队列。新增completed而active0、删除、同count换值都拒绝。完整四历史文件+精确journal之外的任何outbox/final/未知文件拒绝；旧runner整组确停、唯一已登记writer、marker/runner与同op/CAS仍必须成立。不是任意port给true/count就获准。

真实af51源码因果：claim先锁runner，非accepting在选任务前返回；attempt INSERT与task running同事务提交后才返回assignment，runtime只有确定response与journal.accept后才start。锁内证据覆盖所有已提交可能结果；无法还原原HTTP结果，所以结果仍UNKNOWN。旧runner停止不能排除中心尚未进入事务的旧HTTP请求：hold期间它只能返回空；接受前必须原refresh确停旧center整组，并重新核全部旧历史。退役成功本身不授权直接resume。

## 七个固定调用

`run.py`只装配七个调用，复用原 `maintenance-continuation.execute` 与 `maintenance-supervise.supervise_operator`，没有第二维护状态机或字节提交协议：

1. **fresh**：当前root ae8500dd及原53+8+reader pins与本片9pins；R4原件hash；真实个人状态仍af51/null backend、Web-host7d1；同operation e655…/draining19；完整旧列64表对R4仅新增drain audit1；精确journal/history；实际7d1完整backendRuntime及6c/policy/C3 tuple。尚无副作用。
2. **hold-stop**：原preview锁内再次固定state/config/op和所有role身份；私有intent fsync后，用原trusted-host holdKey/reason/CAS19进入maintenance20；持久held回执，然后只原stopOwnedProcess停止旧runner并确认整组。center/Web不信号，未知保留。
3. **retire**：原preview锁→同runner行锁→完整生产SQL/history/source证据→原80B backup/intent→二次confirm→唯一inFlight=null atomic rename→audit。旧默认合同不改；真实pending=1如实存证。之后46B exact idle/四历史及完整旧列仍只audit+2，记录真实同operation，不修改maintenance文件。
4. **refresh**：固定安装7d1/6c公开 `maintenance-host.mjs refresh`，同op已maintenance无需重hold/新bootstrap；原流程停止旧三组、真实迁移/新三roles ready-paused。
5. **paused**：原facts/history/checkpoint复用，旧三组（尤其center）全部absent、旧64表所有旧列保持，只有8 migration+2 audit新增；固定配置、旧Web pointer/retained、实际新tuple身份保持；新v2精确runner绑定且assignments=[]。持久checkpoint之后才下一步。
6. **resume**：固定产物同operation公开resume一次。
7. **final**：原facts/checkpoint确认启动与中心accepting分开；actualClaimRecovery=UNKNOWN。没有自然用户领取receipt+持久assignment证据，不把v2初始化、configuredProfile、空轮询status missing当新PID成功领取。不给中心POST claim、不建任务、不query、不回滚自然用户工作。

## 固定输入与停止

`plan.json`只引用原maintenance-continuation参数/53+8+reader来源，另列新delta与4原件；旧inputs/原件不改。root现在ae8500dd是工具操作上下文，实际旧state.source仍af51，目标artifact/source仍7d1/6c；不能以新root代替旧runner来源。原R2 reports/策略/迁入/Web替换已消费，当前plan没有这些入口。

全新 `personal-held-continuation-r1` 尚未创建。operator启动至所有bindings/save/fsync/调用受同一900s+2s reap外层期限，内层原OPS14 childPidOnly各自有剩余期限；外层absent只证明operator，缺内层Report仍UNKNOWN。detached个人roles只由原nonce helper/维护FSM操作，外层不杀服务。独立模块准入在launch前仅读固定小源码，不个人I/O。fresh至少7,515,275,264B并保原2.5GiB/live1GiB；沿512MiB总新增、2MiBraw，本片私有审计≤1MiB，max15配置连接保守账。实际window需Lead确认，无预占。R4原900s不追溯延长，新段实际开始最长15min。

所有gate/identity/SQL/写盘/退出unknown均停止后继，保留backup、intent、stage、DB和原记录；不重试、取消、清队列、rebase、重bootstrap或猜杀。

## 验证与限制

core source0f5891da：9新+3原直接guard用例12/12，262ms/9275B，原默认与反例均保留。caller06e70f40：3纯例、真实Node/pg/原maintenance入口导入（0connect）及新7phase/旧12phase参数检查4轮776ms/5187B。最终ec9c7754新增backendRuntime静态入口复验426ms/300B；实际个人调用NOT_RUN。合计1464ms/14762B、6组absent/双EOF、全部exact scratch removed。导入可用不等于现场通过。

模块设计复核：复用原提交primitive/锁/历史比较/监督，显式confirmation选择只集中在原guard与实际SQL生产者；新caller只固定当前参数。采用已安装find-skills、codebase-design、clean-code和已授权bounded设计方法；无新依赖/安装。清楚保留错误、唯一状态权威与停止语义。旧git add因sparse路径拒绝后仅用--sparse指定已领取4path；无全树物化。
