# 同版本网页恢复

本次已恢复原网页服务：后台仍362、runner accepting/v15、当前页面caa1/v2，旧会话及任务保持。只调用既有`web bootstrap`一次，CLI退出0/922ms；没有主动provider调用、刷新用户tab或升级页面。

固定准备ce6fec与7个工具/3配置绑定362。Lead先固定原Flow checkout而不回退main引用，结束于18:36:52恢复原main ec5；没有安装或改node_modules。`source-window-closed.json`是Lead操作回执。

外层第一次身份检查错误地保留了ps字段间4个空格，三项false原样保留，bootstrap调用仍0。经Lead明确许可，改为固定工具的`inspectOwnedProcess`，三项running且其他gate仍true；同reservation只执行一次bootstrap。正式工具实现没有改动。

操作先wx/fsync reservation→修正preflight→wx/fsync invocation marker→单次CLI→fsync stdout/stderr/exit checkpoint→一次只读after→fsync preservation checkpoint。旧Web group65219已ESRCH；新wrapper23534/child23631 owned并监听原端口。CLI内部身份等待已确认ready，未额外发送个人身份请求。

旧pointer的backendHead为b1c，与实际后台362不同，未重写历史：bootstrap在停止前查验两产物各自的362报告；static host依pointer验证原两套b1c报告。两产物/四套报告、pointer、config/claude/maintenance hashes、正式runner身份、后台记录、4成功task/队列/会话元数据前后相同。state.json预期变化；完整私有state JSON未另存，非Web进程比较依据保存PID/group/start时间及正式helper前后对完整command/nonce的身份匹配，未虚称保存过全私有字节。

结果不证明个人64 CLOSED累积原因，也不是新d629发布或af51后台更新；两个旧产物对af51验证仍由SVC05R01后继完成。失败记录不覆写，后续无探针或自动重试。

文件绑定见`operation-manifest.json`，个人秘密和用户正文不入报告。clean-code复核：复用单一原host状态机/身份helper，外层只负责记录与一次调用；没有增加恢复产品接口。
