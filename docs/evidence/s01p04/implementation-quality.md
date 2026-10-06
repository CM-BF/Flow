# P04 implementation clean-code check

2026-10-06T11:20:12.138Z，status_read / gpt-6-astra；复用固定本地find-skills/clean-code/codebase-design/tdd（技能来源见skills.json）。

私有 `lockRunnerForAttempt` 明确单一职责：在调用方既有事务持有共享凭据fence并复核revoked；void返回不暴露可变runner，固定SQL不接收任意mode。public lockRunner继续返回完整runner/独占锁。唯一重复为相同401错误身份判断，保留两个真实权限使用语义，未制造通用锁框架。

逐字重建证明：去除6行私有helper并还原ownedAttempt首调用，runners.ts与approved main648完全一致；ENG claim SQL及所有其他函数不变。测试相对cd13只增加已查询PG版本的记录，9项断言/资源owner未删改。

新9项真实PG均通过：不同attempt的ownership/heartbeat/report在首事务释放前完成；同attempt等待与seq/幂等；revoke等待/新读取拒绝；读者等待撤销writer提交后重检；drain仍接受既有工作且hold要求零active；capacity1与unknown占用；protocol/goal外层强锁代表；missing/foreign/stale/expiry保护。ENG只复用claim过滤单项1通过/12未选，未跑全库。局部strict0继承根strict/noUnchecked，无宽松选项或安装。

两个专库按各自真实cleanup收束，PG16.13；无provider、native SDK、runner child或新混合窗口。原red与准备日志按旧target保留，历史43绑定可重现；当前4个不同路径均显式归于受控main或本片小改动。生产main集成及独审仍待，不把本地交错测试当整体容量结果。
