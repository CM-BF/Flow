# RELEASE03 432b 资源门禁窄复审

**APPROVED，0 blocking；仅源码delta，非运行或发布通过。** 沿此前997d两源完整审查，本次逐读997d→432b全差异，两源fixed/current匹配，diffcheck0，当前46395a clean。精确SHA256与时点见audit.json。0import/types/HTTP/PG/Chrome/provider/项目写。

- browser49–52：history单轮<=60s且沿20scleanup；history起始1GiB+32MiB/停止1GiB+16MiB，all保持128/64，不把A预算继承成B授权。
- browser92–105、121–150：monitor在业务import及CREATE之前启动；统一checkpoint在主要await后重核free/evidence/deadline，stopWork后assertWorking阻止后续新资源动作。轮询仍不是物理硬配额，DB逻辑12.36MB样本不是峰值上界。
- browser183–186：清理先停interval并等待在途monitorTask，避免清理期监测迟到写状态；原hard deadline/ownership marker/child PGID/无FORCE/失败无SVC绿回执保持。
- fixture27、63–69、132–149：Git读取有2s超时；artifact/factory/listen关键await前后核abort；创建成功后晚取消仍经原catch/全进程监督清理，不产生新的公开test开关。

仅凭源码不能证明A两项通过或清理无残留。正式运行需管理fresh窗口、本人freshfree及准确gate；A-only必须封存结果、B保持NOT_RUN。budget计时完成不等于cleanup成功，manager仍要读errors/databaseRemoved/过程组事实后交回资源窗口。
