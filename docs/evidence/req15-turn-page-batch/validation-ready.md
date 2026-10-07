# REQ15 剩余局部验收入口

2026-10-07恢复准备，**NOT_OPEN / NOT_RUN**。产品/局部结果仍为d209，原26/26与strict-v2不重跑；PG两case源码5ddddd6a已独审，95输入manifest `df2cd82a7951b030b90e02c5f84d5ef2ce8150dc72901ab8fd4d11e8fb25439e`逐字不改。当前仅为已有run-check增加两个固定payload，新增delta须先源码独审；未导入、编译、收集或执行该delta。

02:37:41.342Z fresh账本确认REQ15 claim09b83400 v1 ACTIVE、owner/branch/WT与10scope不变。只读核95文件429768B、9deps realpath/package hash、8driver文件及旧supervisor SHA982c均一致；六PG实际输出与两份新轻检查的六输出全部absent。一次磁盘观察25,745,203,200B，旧空间不足阻塞已解除；这不是共享窗口授权，运行前仍须各自fresh gate。恢复任务时SVC06持轻slot；Mika后续通知Lead正恢复现用61228 Web页面、本组没有actual holder，期间不新开PG/Chrome/安装重负载。本任务继续准备，所有实际运行仍等明确归还和OPEN。

## 唯一剩余局部顺序

cwd均为 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/conversation-turn-page-batch`。以下仅准备命令；每一步须获得相应窗口，先核fresh claim、固定reviewed HEAD/clean及现成依赖，不裸跑Node payload、不安装或自行供给。

1. 新PG fixture局部types，只覆盖tsconfig.pg.json：

```text
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/req15-turn-page-batch/run-check.py pg-types pg-types
```

2. types成功后，显式单路径collect，预期实际收集2条，**testPasses=null**：

```text
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/req15-turn-page-batch/run-check.py pg-collect pg-collect
```

固定collect payload为Node24/Vitest4的`list docs/evidence/req15-turn-page-batch/pg-turn-page.test.ts --config docs/evidence/req15-turn-page-batch/pg-vitest.config.mjs --configLoader runner --no-cache --json --no-color`。`--json`仅使收集结果可数，读取实际name/file列表；必须恰有两条且都属于本fixture，0条不通过。实际list结构已只读核安装的Vitest `cli-api.B7PN_QUv.js:13594–13625`，未运行CLI。固定config没有setup/globalSetup；fixture顶层只读输入/构造数据/注册两case，Pool与专库启动在beforeAll内的OPEN guard之后。轻入口清除REQ15/SVC admin/OPEN/deadline及通用DB env，collect不运行beforeAll。

两个轻命令各30s观察预算、27s子进程截止、raw合并64KiB，fresh free≥1,107,296,256B；各自wx0600的`pg-types.json/log`、`pg-collect.json/log`及独立0700 `*-tmp`。Node编译缓存与Vitest缓存关闭。TMP预期空，记录前后采样及原dev/ino，只移除同身份空目录，异常内容保留；32MiB是采样预算，非实时硬隔离。入口时间从自身preflight起，超过30s明确UNKNOWN；解释器启动与最后receipt持久化不受supervisor实时保证，实际tool结束仍需单独观察。非零子退出、raw完整性及生命周期分别保留，不覆盖旧任何检查输出。

3. 两项轻检查完成且另获唯一PG窗口后，执行原封套一次：

```text
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/req15-turn-page-batch/execute-pg-once.py --expected-head <Mika明确绑定的本轮clean完整40hex> --manifest-sha256 df2cd82a7951b030b90e02c5f84d5ef2ce8150dc72901ab8fd4d11e8fb25439e
```

仅该PG进程安全source既有env并映射FLOW_REQ15_TEST_ADMIN，不输出凭据。原PG wrapper保留：总30s、20s工作/27s清理截止、3连接、64MiB DB预留、PG floor1,207,959,552B、raw64KiB、fixture JSON合计32KiB、seed≤4MiB/TMP采样32MiB，0HTTP/provider/server。PG1覆盖mixed51/paired unnest/LATERAL LIMIT2/全文hash suffix损坏/UTF16边界，PG2覆盖真实query barrier后writer COMMIT ACK与同client RR旧pair/新pair。两case必须实际selected2/pass2；fixture条数不算运行证据。

PG依旧要求原Promise收束、subject/writer.end、固定专库OID/marker/owner核验与连接0后普通DROP、absence/admin.end；未知不自动重试/terminate/FORCE或换库。六输出保持原names，原封套与95manifest不变。SVC07已完成并release只影响其写权；本任务只读复用固定旧supervisor纯函数，ROOT仅进程内设成本树，不迁移OPS14、不写SVC07。

## 收口与限制

仅本地薄caller新增pg-types/pg-collect固定选择及敏感启动env清除；原tests/types命令payload不变。命令表是唯一选择源，没有第二监督循环或通用可执行payload Interface。clean-code/codebase-design复核了固定Interface、输出身份、失败与收集不冒充pass。当前仍0新types/collect/PG，HTTP直接消费者按原计划留集成点，不扩createServer闭包；真实roundtrip/UTF8字段载荷仅以后实际PG测量，不复用fake214或历史252。
