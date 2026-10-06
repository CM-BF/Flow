# 实际验证与范围

固定target 902c9b5d35e1795d564c077034dc78cf1a36b6a0；Node24.20.0。最终`node --test`三文件：新proof-tree-batch、现proof-snapshot及human-proof，27/27、0skip、12,968.360208ms，[原输出](final-direct.log)。执行HEAD就是902c，只有自有证据未追踪；[checks](checks.json)与[source hashes](source-binding.json)是事后归属，不篡运行日志。

新10例涵盖128literal一批+下一snapshot dirty、目录/子文件去重、兄弟前缀/缺任一范围、main范围缺失、不同repo/commit、完整mode/type/OID/path（含TAB/newline/Unicode、symlink/gitlink/executable）、真实stdout2MiB超限可分与单叶不可分、真实ARG_MAX/E2BIG、普通失败及5秒timeout不回退。仅失败/timeout使用受控Git shim；尺寸与参数超限使用真实Git。旧17直接消费者保持。

## 有界真实聚合实验

[baseline](baseline.json)、[after](after.json)及各自Trace2原件保留。相同结构：1临时repo/2worktrees/5scope（含重叠）/5独特source文件，16/64/128 synthetic注册，调用真实aggregate。两轮不同合成commit：baseline `5f4529721d854dc490f98e9546ec64121d705216`、after `e0ef529332efc4ec97e5a135bd44fbeab0e3205c`；不冒称同target。每样本current/unchanged/approved/integrated数量完整、issues空；协调DB未连接，assignmentState明确unknown。

| 来源数 | Git starts 前→后 | ls-tree 前→后 | 峰值进程 前→后 | 聚合墙时ms 前→后 |
| --- | --- | --- | --- | --- |
| 16 | 392 → 200 | 240 → 48 | 19 → 27 | 2152.458 → 702.348 |
| 64 | 1544 → 776 | 960 → 192 | 33 → 17 | 6965.193 → 4313.254 |
| 128 | 3080 → 1544 | 1920 → 384 | 31 → 21 | 9266.070 → 8102.783 |

baseline开始2026-10-06T10:32:34.897Z，含setup/清理21,046.636458ms；after开始2026-10-06T10:36:57.737Z，含setup/清理13,850.574917ms；合计34,897.211375ms。原trace合计16,081,552字节，低于60秒/32MiB；两个cleaned=true，剩余Git进程0。全部临时fixture已清理，零真实repo Git负载/服务/DB/provider/4320请求。

baseline proof hash `ba454106f6d99a864f7344fb6a2bce632fc8833d1e68a8fea4a71db88729fa18`，after `0ff14488a80ba10624e7c5ab5e8dd961f2ff4e994d0faf42ef768c9509d563d9`与固定target同；aggregate hash两轮一致 `81a20492f80e58cdbc28a36c49ef514aae0c656782020c413ce8e11f4c29494c`。两轮当时HEAD均f78680fc（before基线未改，after自有dirty），不能倒填902c执行。初版measure在baseline后仅增加显式label/防覆盖/组合预算守卫；fixture与聚合采样逻辑相同。

ls-tree在此五scope样本减少80%，总Git starts约减半。墙时只有一次共享机器样本，无重复统计、无稳定整体提升结论；16源峰值19→27，不能声称并发峰值全部下降。main dirty/untracked重复读取仍保留，synthetic128不是runner/provider容量。

## 失败与修正历史

[red](red.log)：旧生产128个ls-tree对预期1失败。第一次24/25中overlap fixture gitlink被看成dirty，见[first-green](first-green.log)/[diagnostic](overlap-diagnostic.log)，修fixture skip-worktree；不是产品错误。第二次26/27中生成的受控Git shim含非法换行，见[second attempt](second-green-attempt.log)/[diagnostic](shim-diagnostic.log)，修测试脚本。随后[green](green.log)27/27；可读性格式调整后[shim](final-shim.log)1/1，再最终固定27/27。失败未删/skip/清洗。

源码diffcheck为0；全metadata diffcheck仅raw历史first-green.log:45/47、overlap-diagnostic.log:16/18、red.log:16/18的断言缩进空白。原日志保持，不泛称全evidence零空白。未运行全库、真实页面/部署时延、provider、DB或容量压力。

独立review：root 2026-10-06 10:41:14 UTC APPROVED；独立27/27、0skip，14.568745417秒，[原log](root-independent.log)。该局部回归与60秒限额的aggregate性能实验不是同一计量，未增加实验样本。
