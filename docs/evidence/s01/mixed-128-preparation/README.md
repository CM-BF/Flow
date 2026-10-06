# S01 128准备固定审查入口

本片只准备一个128 task/attempt的fixture窗口；**实际capacity调用0**。sourceTarget由manifest固定，base main1c496835/受控合入07c8；writer8e4660a6 v3三scope合法。旧172文件由prior-freeze绑定，旧raw/manifest/unknown journal不改。设计批准：Mika/gpt-6-astra，2026-10-06 12:11:31 UTC；实际运行尚未开门。

## 实现与证据

- [Interface](interface.md)与[input-contract](input-contract.json)：唯一8×16 fixed profile透传原mixed driver/child/proof/时间/字节门禁，没有第二benchmark或产品改动。
- [最终纯检查](fixed.stdout)及[精确source/command回执](fixed-receipt.json)：9文件40/40不同checks，旧直接消费者24+新16。初始4/4真实red、后继4/38/8均是相同或增量检查，不累加；0tests不冒充通过。全部原stdout/stderr/exit保留。
- [最终局部strict](fixed-types-receipt.json)：继承原ES2023/strict/noUnchecked baseline，exit0；初次test stub query arity错误exit2及后继通过记录均保留。未改依赖/tsconfig/产品源码。
- 工程检查仅fake Pool/clock/record/error/stream与固定Git输入读取，历史P03输入从0cee Git读取，因为当前main runtime已前进；没有真实PG/HTTP/center/runner/fixture容量预演。Vitest/tsc/只读Git进程不算执行端容量，0 provider/SDK。

## 成功条件不是预测结果

必须真实128唯一session/task/attempt、8 runner每16、DB全库独立计数128；唯一fixture session经session事件/ACK持久flow.sessions，终态active_task_id为null；不是128conversation对象/nativeSDK/model请求。gate先核running/live/fence；新private proof核每attempt窗口内≥2message ACK且首末≥4s、continue heartbeat、每个adapter覆盖6s以及全部event id/seq/digest/owner/accepted计数。单child单调时间报告逻辑峰值、barrier等待和128共同ACK跨度，parent收到IPC的phase不冒充跨进程精确时标。

DB query记录parent start/end。measure发送前t0与收到window-start的t1给出保守窗口[t1,min(t0+6000,首adapter-end收到)]。所有完全落入该区间的DB样本逐行绑定原gate且running/live/fenced/session一致，至少2样本且跨度≥4s；任何异常样本FAIL，跨界样本单列排除。此证明采样时刻事实，不是连续无间断lease/锁证明。

## 计量和停止

180秒含预核/启动/全部自动证据/cleanup/CLI；150秒停新工作。完整阶段截止来自fixed profile；stdout发送有独立outer clock、UTF8 line上界32768和write callback/error/deadline门禁，driverfinalElapsed不含后续CLI；receipt明确elapsedBeforeCliWriteMs。最终32KiB CLI和1MiB后续归档是保守预扣reserve，不当实际字节数。

256MiB总量，192MiB软停+64MiB收束；计可见固定输入/准备档案、自有HTTP/PG Node流、IPC、保守payload重复和raw/结果，不声称全OS/模块加载IO、物理磁盘或TCP重传。每条observation在保留前预留compact UTF8最终JSON字节，末次写入核精确相等，不漏计或再次当新额度。单流计数/record计数/队列/feature detection未知即不能PASS。

cleanup在自有child close后有界采集全库task/attempt/session最终计数和安全身份摘要，失败也保存；CREATE请求前记权属，确认自有连接结束+精确库0连接后普通DROP并核absent。未知journal/资源保留、强停不当正常收束，不重试/补数/清意图。旧保留journal不打开。实际资源名/动态端口/PID只有未来唯一run会产生；本次无新服务。

未验证：真实128是否可达到、其持续跨度/内存/池等待/事件ACK/清理是否能在此预算完成。独审通过仅允许Mika考虑单次运行，不是容量PASS、严格speedup、native模型/token或SLO结论。
