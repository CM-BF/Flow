# b2b 固定 Flow-source 构建入口（待独审/NOT_RUN）

唯一执行入口 `supervise.py → entry.mjs → existing prepareBackendArtifact/verifyBackendArtifact → runtime-proof.mjs`。复用 SVC08 build-once 的已审流程，只替换固定来源/新 namespace/新增策略模块加载断言；builder、clone、安装器和 OPS14 无修改。新 `actual-first/` 和 `outer-report.json` 必须不存在；不自动重试或重用旧 reservation。真实构建须 Lead 明确实际共享窗口，不能以本准备记录直接启动。

```sh
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/opt/python@3.13/bin/python3.13 docs/evidence/svc06/update-b2b-candidate/build-once/supervise.py
```

执行 cwd 是唯一 owner 的 backend-release worktree；source 从真实 Flow 的固定 Git commit `b2b5612b2a63106ad0e674ddf12b2e8f96cf3388` 归档，不要求切换或冻结 moving checkout。执行前 fresh 核 claim v7、固定 source/17 个 runtime bytes+realpath、entry manifest、Node24、目的不存在与合计空间；未知停。实际原入口创建自有0700随机根及0600 durable intent/raw。

## 固定输入和已发生观察

- [inputs](inputs.json)：69 个固定来源关键输入（含33 SQL）；source archive 996 files / 7,811,090 logical B。7 importers，根 tsx4.23.15/pg8.23.1 与 Web Vite8.3.2 的显式 host 工具闭包；仅 server/runner workspace 生产依赖，未安装整个Web workspace。
- [source-delta](../source-delta.json)：14个manifest/lock/workspace声明与旧422逐字同，9个实际builder与b2b逐字同；14个关键source变化明确记录。旧3230/422产物不能代表本目标运行。
- 08:50:31.367Z→08:50:33.487Z 只读 cache 观察：271 packages / 10,648 selected files，索引2,252,500B，selected logical354,552,778B；st_blocks×512按device/inode去重383,692,800B，不是APFS exclusive物理占用。11,678安装引用 / 355,913,111声明B尚不含layout/manifest。
- [cache-supervision](cache-supervision.json)原2172ms/exit0/108,679B、双EOF、组absent；初次unknown/EPERM观察保持。无自有scratch、无依赖payload重hash/copy/install。原3个mode差异及原历史probe失败保持；[独立解释修正](cache-interpretation.json)明确原raw中“applies manifest executable mode”一句不成立，实际clone不chmod。不能把metadata存在等于cache内容完整性，实际clone会核源/目标hash。

## 时间、空间、输出与收尾

外层原 NEW_CHILD_SESSION 420s 工作 + .5s TERM + 2s reap，clone/install各180s上限不增；installer子进程同一受监督组。外层capture1MiB与本段总raw2MiB分开。完整原始Report直接落0600 exclusive `outer-report.json`；group停止先于外层持久化，磁盘等待不延迟停止决定。runtime-proof 15s/64KiB，只有加载与只读selector，不调用factory/runRunner/provider/native binary。新增断言仅确认策略模块export/default-null及固定4/192MiB/32值，尚未实际运行。

| 同时存在的材料 | 规划上限 |
| --- | ---: |
| stage/install及最终artifact（原子rename，不再加完整拷贝） | 1,073,741,824B |
| selected private seed | 536,870,912B |
| source archive | 33,554,432B |
| 私有pnpm HOME/cache | 134,217,728B |
| layout/manifest/metadata及保守余量 | 536,870,912B |
| raw | 2,097,152B |
| 新增合计 | 2,317,352,960B |
| live收尾余量 | 1,073,741,824B |
| 基础fresh最低（严于2.5GiB） | 3,391,094,784B |
| 沿原候选协调余量 | 536,870,912B |
| 本入口fresh最低 | **3,927,965,696B** |

协调余量不是已观测并发负载；执行时若实际合计更高，准入取更高值。500ms采filesystem availability、结束前末采，live≥1GiB且新增采样下降不得超过2,317,352,960B。它受其他writer影响、不能证明精确峰值/硬预留；CoW不假定零成本。原builder自己的1GiB文件/manifest和选择集合边界继续生效。

成功后保留新artifact、自有root和build记录供后继使用；失败/超时/unknown保留stage/lock/intent/原件并停止，不盲删、不自动重试。OPS14判断所有本工作组已停止、双EOF与真实exit；没有detached服务/DB/Chrome需清理。只有明确终态后归还实际窗口，metadata收口不占运行窗。后继自有host/实际迁移/三个App配置兼容/个人更新另验，不以本构建作部署验收。

## 准备方法与质量

沿本任务已读本地 find-skills、codebase-design、clean-code 方法，复用深模块的小公开prepare/verify接口；仅数据化新target和必要加载证明，不复制packager/监督循环。安全点核名称、单一职责、失败保留与不重复已绿检查；本轮发现并明确更正cache解释文案，原件不改。技能来源仍见本任务既有记录，不重装或新增依赖。
