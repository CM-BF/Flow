# Snapshot Git Interface

`createGitSnapshot()` 返回 `execute(directory,args): Promise<string>`（原始stdout，不trim）与 `mainChanges(directory,capturedHead): Promise<{dirty,untracked}>`（两个原始NUL输出，只读）。aggregate每次创建/显式注入同一context；独立observeGit/compareImplementation/integrationProof不传时各建局部context。aggregate原git文本调用自身trim，proof保raw再按各处需要trim，不能统一trim破坏路径。

执行器只管child资源：每context最多4个execFile，FIFO等待，5秒timeout从child开始，不把排队耗时谎报child执行；2MiB maxBuffer/GIT_OPTIONAL_LOCKS=0不变。成功、spawn失败、超时及buffer溢出完成后finally释放。不在持有许可的proof父层递归申请；ls-tree失败清partial stdout后仍原串行二分，仅MAXBUFFER/E2BIG可分拆。

mainChanges同步登记目录+capturedHead的Promise，只在该snapshot使用；dirty以capturedSHA对照，与untracked并行完成后再一次rev-parse HEAD，不符或任一失败拒绝。失败不变空集，所有依赖proof保unknown，下一context重读。不缓存scope/tree/proof。owner compareImplementation的dirty也以传入head对照，不改变NUL/metadata/path语义。末HEAD核对为保守检测，多命令仍非原子观察；不承诺检测A→B→A、branch切换同SHA或查询间工作区变化。

四proof原28条中main观察8条变3条，预计23；主线proof其余20条不去重。不是实测或吞吐/CPU/SLO承诺。

测试分层：受控executor测排队/故障/释放/全部入口；新临时Git累计45秒（前35秒新样本，≥10秒清理，≤8MiB raw），同main4proof、8repo观察、fallback、跨snapshot变更/HEAD移动；现有直接消费者必要回归独立归因，不重跑旧benchmark。没有安装新依赖或正式服务变更。
