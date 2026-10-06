# O10 零query验收准备证据

固定产品base fc113945ff73d1a43092d0a70b51e901aa4be1e2，实验target `3c770b52bb4e2e8b3c8b217b9d7900dda688263d`。作者 assignment_review / gpt-6-astra；独立review NOT_STARTED。仅实验三scope，产品与旧O08源码保持原样。

实际通过 **11个不同检查/场景，分批完成**：6个guard/预检行为，1个成功真实PG+独立runner注入旅程，4个拒绝旅程。没有声称一次11/11，也没有重跑O09的27领域或O08的11历史检查。

| 原始文件 | 结果与边界 |
| --- | --- |
| guard-red.txt / driver-red.txt | 初始模块未实现导致import失败；不是产品行为回归 |
| guard-first-green.txt / driver-first-green.txt | 初始两个行为各1/1；属于后面6项的重复运行 |
| requested-gate-red.txt | 真实行为红：未检查disallowedTools导致扩大工具配置未被拒绝 |
| guards-final.txt | 补齐精确拒绝集后6/6，含虚构identity reservation重复拒绝；没有可用native许可 |
| rehearsal-first.txt / rehearsal-first/result.json | 真实生产factory/PG/publicclient/独立runner，query帧注入；1task/1execution、同final/artifact、机械通过、accepted=null，0provider |
| rejection-journeys.txt / rejection-journeys/*/result.json | 4/4预期拒绝：init差异、host拒绝、allow无Read成功结果、is_error=true；每次新隔离DB/PID |
| prepared.json | 当前默认预检、固定sourceDigest/依赖hash/候选配置；非注册profile/有效许可 |
| syntax.txt | 5实验实现与3测试模块Node语法检查；不冒称全产品typecheck |
| install.txt | 现有lock frozen offline ignore-scripts，reused540/downloaded0，未改manifest或锁 |

五个PG旅程均自有进程组state=stopped、DBremaining=[]、center/临时目录清理全true。所有报告nativeQueryCalls=0；读取材料和SDK事件只是合成演练，尚无provider/NL/费用实测。失败旅程原outcome保持failed-or-unknown，不为了测试预期失败改成产品成功。

Read许可和执行证据分开：allow-without-read场景有成功正文与flow.text passed，却因缺少匹配工具结果被拒绝。机械通过只验证含“纸鸢”字串，四项事实由未来GO阅读全文决定，semanticAcceptance始终not-evaluated且无accept-delivery命令。

复用依赖：O08的stopWorker、recordHostDecisions直接import，相关driver/guard/config/peer固定hash纳入source；O08 reservation hardcodes另一预算，故只复用其已审wx+fsync算法，O10独立kind/limits/marker目录，不变造旧permit。新版原生能力未被验证，不绕组织managed资源。

复跑/后续执行前置见[实验README](../../../experiments/native-child-acceptance/README.md)。独立审查与新GO单次预算分别要求；准备批准不等实际执行授权，当前没有permit。

固定[manifest](manifest.json)：9个实验源/说明文件、18份原始输出、15项固定依赖；prepared sourceDigest `3f7a3323606956ba194536d55c7957037babcd7247e89ff2ab250acc286f7a87`。sourceDigest绑定5个实验实现与15项依赖，测试/说明不改变运行许可绑定；固定target包含全部测试。
