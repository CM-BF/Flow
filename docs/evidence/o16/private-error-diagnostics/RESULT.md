# 私有错误诊断：零模型局部结果

固定行为与测试49d35d97；7新不同检查分三轮通过，14次选择，非单轮7/7。首轮2通过/5失败是新fixture漏原PreToolUse hook，原错误保留；只补fixture后复测5通过。最终空字符串missing规则和结构观察16项上限只复测受影响2通过。旧7/15/16/26没有重跑。

3轮监督共1135ms、caller共1187ms、raw7994B。三个自有组最终absent/双EOF，无signals；三个exact外层scratch正常移除，末采0B不能当峰值0。中间EPERM观察不改绿。0PG、SDK进程、认证、provider/个人操作，无第三次请求预算。

直接验证success subtype+isError私有先持久/公开受控分类，缺失/空/非字符串/超界正文unknown，exclusive写失败和报告fsync失败不替代原SDK拒绝，cleanup独立；正常success/早期声明门禁、目录身份替换拒写；SDK声明的assistant.error/API retry/result状态来源白名单与16项限界。未验证真实SDK后继错误正文或账户根因。

本片Interface/源码由owner收口，独审待执行。R2固定失败54bf/d82f已获assignment限定真实性批准并main f7864f88，正文缺口不回填，累计2/账户费用UNKNOWN/DBtmpKEEP保持。
