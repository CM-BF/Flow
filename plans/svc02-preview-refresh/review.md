# SVC02 独立审查

状态：NOT_STARTED

Review target commit：UNKNOWN

base6b4b89f397b35d7e769846df457e76bb29f4a265。固定target后独立只读核016/domain/旧claim兼容、host持有与失败关门、明确resume、原始检查；不可把临时专库测试视为真实服务已更新。当前没有已通过检查或approval。

验收重点：old75a33真实claim事务原语句与输入可核，INSERT gate拒绝时session/attempt/task整体回滚；drain仅拒新领取，active心跳/上报保持，uncertain不释放；CAS/幂等/重启审计；可信host无第二center/scheduler、保密/专库marker/进程identity/operation.lock；暂停保门不等于任务取消。review者不改源码，findings交唯一owner，0模型。
