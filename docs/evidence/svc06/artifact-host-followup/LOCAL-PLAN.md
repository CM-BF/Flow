# 实验接缝局部检查

原Lead授权段：累计≤90s，每轮OPS14 27+.5+2≤29.5s；fresh1GiB+8MiB，新增tmp/raw合计≤8MiB。3个串行node:test：原process身份/stop与实际沙箱子孙拒读及有限stderr；argv不符无spawn；sandbox执行错误保留实际stderr/exit。0PG/真实center/runner/Web/Chrome/provider/安装。每例私有目录创建即记录dev/ino，checkpoint后同identity删除；原helper未知时KEEP不强停，不删未知目录。Capture每流≤64KiB，toy首例仅1024B；整个toy最多3小目录、每目录至多8个文件与<128KiB，outer capture32KiB，本段源/输出均远低于8MiB；不复制原artifact。

后继实际host已由Lead明确采用新独立安装root/新DB/新exclusive run，同卷CoW复制固定e5完整manifest并验证。现只有实验seam检查，绝不执行复制或PG。原root所有失败记录/配置/产物保持。
