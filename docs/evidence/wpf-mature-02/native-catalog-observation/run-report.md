# 原生目录观察：固定规则停止，未取得目录

执行候选 a076f178；源码61e28、prepared a1964a及25a1输入不变。唯一授权窗口已消费：fresh准入全部通过后1个native（PID58000），ready=true，model/list调用1次；0turn/auth/login/模型推理请求。CLI与wrapper均exit1，整体FAILED_OR_UNKNOWN。

收到1条 `remoteControl/status/changed`，公共精确名已识别，但不在既定configWarning/deprecationNotice继续名单，故KNOWN_UNEXPECTED→stop。189B是R06 inbound JSON重新编码值长度，payloadValidated=false；不证明该通知正文、网络行为或账号状态。没有catalog，不自行扩大允许表或重试。

R06受控SIGTERM关闭，child confirmed-exited；stderr2149B、EOF及child-close确认，未截断。自有收据FD均closed/flushed；完整关闭后样本123项含3个symlink自身，logical2836488B/allocated2990080B，均低于8MiB。两个本次根按登记身份清理，随后仅lstat确认absent。2149B诊断及207B outer仍0600/ignored/nontracked KEEP，只核身份/hash，未读正文；旧保留根/原件未动。跨进程全部writer与活动峰值仍unknown，样本不是硬配额。

输出账使用CLI写后快照：prepared186303+policyDisk17393+stderrCapture2149+两disk4298+receipt3476=213619B；加CLI4110、outer639=218368B，再加本次archive实际枚举。原result.json中的receipt205是写入自身3271B之前，不能代替后值3476；删除不扣账，archive中的safe文件保守重复收费，与prepared互斥。stdout累计wire未知不改写为实际捕获；本片预算口径沿已审留存/capture/副本范围。

自动wrapper 19:56:50.219863→50.717580 UTC，0.497744s；含fresh的工具命令5.609613s，外部clock19:56:44→50加1保守≤7s。内部434.689875ms/441.962166ms分别为result持久化前/CLI前，不能互当全程。详细工具收据与精确根/private身份见相邻JSON。准备/执行安全与计量收束不等于目录成功、真实模型资格或完整MATURE02交付。结果待独立忠实性review。
