# REQ15 公开分页直接消费者

准备状态：SOURCE_REVIEW_PENDING；实际 HTTP / PostgreSQL NOT_OPEN。固定主线为 `7b6a196da1cc8d95da09b27fc334555a119ba4bc`，不是本分支旧 database.ts；原产品已由 main 接收，本次只补 REQ15-04 的 HTTP 验收。

## 固定输入与原断言

[来源回执](http-source-receipt.json)绑定 `http-main/` 中 215 文件、886512B 与固定 main 的逐字相等关系，包含 30 份 SQL。26 份来自静态 URL，另外4份来自已有两个 migration 文件列表（012/013/017/019）。所有 snapshot 文件0444，只读使用；没有覆盖本树已有源码或移交 C02 的 state.ts/replies.ts。

`http-original-case-source.txt` 是固定主线 `apps/server/src/conversations/conversations.test.ts` 原文，只作对照，不导入或执行。原 fixture 硬绑 flow_chat01，禁止直接运行。本次仅保留其中 `pages immutable turns and returns long assistant content only through an owned lazy detail` 的一个用例；2110字符断言正文逐字保留，在相同公开分页路径补401/403。Unicode预览、owned惰性详情、跨conversation/turn404、after空、limit51拒绝、列表游标与不可变user断言均保留。

[依赖回执](http-dependencies.json)固定16个本地已安装依赖链接及元数据；两个 @flow 均指向本树 snapshot。供给没有 install、跨树产品 import、共享Git配置或已有文件覆盖。source receipt63951B + dependency receipt5871B；source request63874B另属准备metadata。固定运行工具沿原9个入口与旧supervisor SHA982c，不迁移 OPS14。

[准备 manifest](http-prepared-manifest.json) SHA256 `3bcbdfc8176461ae5a1d9ac256fd3647646e7f7fd69f248f380db6cd97008d16`：227个输入1098695B。manifest自身不含提交号以免自引用；固定source commit见唯一status/review。原PG manifest/原件及原26/PG2/11证据均保持。

## 当前已完成的局部段

X01 local清理后交本owner；2026-10-07T03:42:05.388211Z至03:42:16.117318Z只启动2个child。`run-check.py http-types http-types-1` exit0 /2.113625s；`http-collect http-collect-1` exit0 /1.402533s，实际 collected1、testPasses=null。收集不表示用例执行。raw共271B，两个进程组最终absent、EOF完整、signals/secondary为空，两个TMP同inode空目录清除并独立lstat absent。详见[单份结构化段记录](http-local-segment.json)，没有重跑旧组，0 PG / HTTP / provider。局部时长口径不含解释器启动与最终持久化；TMP前后采样不冒充实时硬隔离。

## 待独审后的唯一实际入口

先收到明确 heavy OPEN；在本worktree、真实cleanHEAD及v2 claim下执行一次。私下 source 既有协调env，把既有授权连接串映射 `FLOW_REQ15_TEST_ADMIN`，显式 `FLOW_REQ15_HTTP_OPEN=1`，不打印凭据。命令：

```sh
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/req15-turn-page-batch/execute-http-once.py --expected-head <当前已审clean的完整HEAD> --manifest-sha256 3bcbdfc8176461ae5a1d9ac256fd3647646e7f7fd69f248f380db6cd97008d16
```

精确child为一个 fixture、一个 case，不运行原 conversations suite。60秒总预算（40秒工作、15秒fixture清理、57秒外层监督截止、60秒最终回执口径），raw64KiB；专用库 reserve64MiB，启动fresh可用空间至少1207959552B且扣预留后至少1GiB。至多13连接（server8/scheduler3/fixture1/admin1）、64个HTTP请求、每响应128KiB；一个task、一个runner，0 SDK/provider/model。TMP8MiB仅空目录前后采样，意外内容保留并报UNKNOWN。

库名与marker固定在[输入](http-input.json)，server动态port0。先wx reservation，再CREATE；匹配OID/marker、所有自有server/fixture池关闭并观察零连接后普通DROP，不用强制DROP或终止他人连接。CREATE/启动/close/持久化不确定时保留精确身份，原失败不被清理失败覆盖。监督器立即持久化自有PID/PGID；业务退出与raw完整性分开，历史unknown不被最终absent抹去。没有自动重试。

七个实际输出（含TMP）当前全部absent：`http-run-reservation.json`、`http-database.json`、`http-server-1.json`、`http-result.json`、`http-output.log`、`http-exit.json`、`http-tmp`。入口核输入hash、依赖realpath/metadata、cleanHEAD/branch、fresh完整v2 claim和资源后才创建输出。任何准入失败HOLD/0child；实际失败或UNKNOWN停止并保留原件，不换namespace绕过。

## 一次独审范围

只读核固定main闭包/动态SQL、原单例断言与新增401/403、生命周期/错误优先级、预算与监督接口；核局部两输出的忠实性与未运行边界。types/collect证明可解析与收集，不能代替实际HTTP行为。独审不启动PG/import/tests；实际结果另按同一工作段收口，不增加逐条批准链。

审查修复：执行封套在删除TMP前要求已得到exit、group absent、EOF且历史observations/signals无unknown、secondary为空；事实缺失或未知则保留原目录/inode。只修caller，旧supervisor/fixture与局部原件不变；http-local-segment中preparationManifest记录的是原bc4cdf5d9b4daa9bd6f1a95433e823fd33c0d148历史准备manifest，当前新manifest只重绑这一caller修复，不伪称局部checks执行了wrapper。
