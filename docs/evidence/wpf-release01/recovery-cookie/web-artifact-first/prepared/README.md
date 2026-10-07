# RELEASE01 固定新 Web artifact：静态可审包

状态：REVIEWED_SOURCE_BOUND / ACTUAL_NOT_RUN。准备固定 2026-10-07T15:20:57.089Z；无 gate、import、语法/产品检查或 build。source 已批不等于 caller 已批。仅 artifact 供给，compat/个人更新由既有链后续处理。

- 唯一入口：`python3 /private/tmp/release01-web-artifact-prepared-20261007/run.py --admission <真实准入文件>`。当前 caller 已限定批准；admission.example 的 authorized=false，无真实build admission。
- 固定 HEAD `c2311b6bd44a2a8e73e3b066be5f12bc8b153b37`，base7272、产品1cea两hash802e/728a、root审d736。当前本地clean；GitHub两次500，remote仍cd074（d736已在remote），不冒双端相同。
- exact2产品已15:10:52.444Z原子移出；claim7d60 v2仅两harness+ownrecords。此包不编辑产品或共享配置。仅获co-lead供给角色，actual时exclusive建ignored node_modules，结束反向清理；不是恢复产品writer权。

## 既有 API 和固定闭包

build-entry.mjs 仅调用本树现有 `prepareWebArtifact` 默认实现，随后 `verifyWebArtifact`；没有第二codec、build-port替身或descriptor伪造。原sourceIdentity前后检查、实际Vite版本、root/envDir:false/VITE_FLOW_FIXTURE:false/release namespace/base/sourcemap:false/outDir全部沿原实现。root build 命令内部默认90s/maxBuffer65536；外层新150s总含30s清理，120s工作包括准入文本/哈希核验。output descriptor必须真实构建+全file verify后才写，format2/唯一releaseId；新Web descriptor现在NULL。

input-pins.json：219个固定源码/config；252已安装包、13700 files，logical137183284B/allocated观察175386624B；没有复制这些依赖、没有安装。它们是既有KEEP，只读包图含已解析required/可用peer/本机optional，required缺项=[]；不是声称所有条件路径都会执行。固定6个native（rolldown/oxide/lightningcss两版/fsevents/esbuild）由文件记录列明，不启动它们。Node实际24.20.0二进制固定；系统链接库不是额外已封自有payload。

dependency-links.json 列精确外包实路径、本树3个@flow及zod。禁止整根donor node_modules链接。现WT/node_modules不存在，actual caller仅exclusive创建自己的小目录/links；preexist、changed identity、unexpected entries全部KEEP/FAIL，不清他人目录。当前不物化链接。固定Vite node.js:37903–37925在nearest node_modules/.vite-temp写bundle；唯一.vite-temp→本run scratch/vite-config，sandbox只允许actual根和/dev/null写。外包只读，原项目tracked源码只读。没有NODE_PATH或环境回退，不改lock/config。

## 资源和生命周期

新150000ms total/30000 cleanup，spent0；旧6165/83835 CLOSED不借。Python parent + 1 Node public API caller + 1现有内部build Node顺序/嵌套，现builder还会短暂调用Git；必要esbuild子进程与native线程均同owned process group。无PG/Chrome/HTTP/provider/个人服务。精确最大线程数取决于已装native实现，未实测不冒单线程。网络由原同型Seatbelt deny network*，不连接61228，不读个人env配置。

新增allocated规划256MiB一次：scratch128MiB、artifact96MiB、retained8MiB（含prepared+raw+256KiB outer/终态）、metadata1MiB、links metadata≤256KiB，余量含目录开销。逻辑和allocated分别采样；原API本身还有64MiB assets/4096files/单file32MiB/manifest1MiB硬规则。完整准入floor≥14,414,970,880B且从当时更高complete sum，单reserve一次、旧KEEP不退；这里只候选界限，没有freshfree。只读175386624B不是新增复制量或可回收保证。

复用OPS-METER固定52b9255 helper：一次遍历按精确scratch/artifact子树剪枝，分别记regular logical/allocated。unknown STOP、owned group仍清理、scratch KEEP；不猜未知为0。helper不计目录/链接inode metadata，上述256MiB预留不把它冒精确实测。原本地parent的方法差量在parent-from-oldconsumer.diff；没有新通用平台。

actual根固定于包内`actual/`，存在即拒绝；artifact-store mode0700按API写一次immutable目录并KEEP，不当scratch删。group退出后独立收actualexit/regular log writer关闭；TERM/KILL/EPERM分别记录，未知不会跳过其他cleanup。临时dependency roots/links只按本次exclusive身份+exact目标反向删，scratch同dev/ino/uid。无通过也不删artifact错误原件；部分artifact保持KEEP供核，不把目录存在冒descriptor。

完成边界为owned清理/测量结束，恢复signals后封result/terminal；不声称through-OS-exit保证。接收必须同时：实际outer exit0、唯一匹配stdout terminal、terminal resultSHA、childExit0/groupAbsent、dependencyRootAbsent/scratchAbsent、完整regular日志、builder真实verify及source/format2匹配、ceil(max outer/late/serialized)≤150000。若signal在seal期间结束进程，即使磁盘PASS也不接收。outer stdout/stderr须原可信执行捕获≤256KiB且无drop，纳8MiB；普通失败无自动第二次。

## 当前缺口与交接

caller source/native+供给清理边界待root一次集中审；无build grant。S01/K01由manager调度，不能据历史return抢窗。metadata推送500是基础设施事实，source已remote且本地固定可审；不等它才审包。后续operator只routine接审查/真实claim/currentHEAD/合计资源，不能换movingmain/换产品。两8964harness继续不变，四App实际要在新Web descriptor与04da/CD27真正配齐后精确改guard并验，不回退6c/7d1，不依此artifact直接宣布compat/main/部署。

技能复用已读本地find-skills/clean-code；检查职责、命名、错误/取消、精确owned删除、无第二authority。实际修正了草稿目录创建失败时可能写preexisting RUN、signal终态说法、复用公共计量而非第二扫描实现。builder整体仍NOT_RUN；后续只对真实cleanup块做两个目录边界的纯Python实际，见[窄修记录](dirguard-repair/README.md)，不冒整体caller或artifact通过。

## RELEASE-BUILD-P2-01 修正与必要局部证据

已固定所有created scoped-dir identity先于首次unlink；保逐项即时校验。两实际合成场景/outer0/保守144ms与精确TMP收尾见[报告](dirguard-repair/report.json)。原prepared mutable文件完整before备份；fixed-source/219输入/252包/entry不改，新的floor14,414,970,880仅管理routine值。等待root这一delta集中接受，无buildgrant。

## 当前限定批准 / 尚未分配实际窗口

Root [固定批准](caller-approval.json)关闭唯一P2；只routine更新binding state/callerReview/latest floor和manifest，c231/parenta63/entry2bcb/固定source与依赖不变。新floor14,414,970,880按最新potential更新（原144ms小段保持旧实际记录），更高完整sum优先。准备READY不等actualNEXT；仍等待d01协调S01/I01真实RETURN及唯一150s build窗口，不触个人服务。
