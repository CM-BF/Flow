# 系统配置缺失观察：独立native准备

旧180924失败已f0b6封存；156B原件KEEP。GO/root同identity精确确认失败是读取公开系统requirements路径时EPERM（os error1）；旧有限模板只认config/errno，补充结论不追改旧raw/report。

新go-native-system-config-once仍NOT_OPEN。原db5e policy完整保留，只追加四个父/目录exact metadata+test和六个指定配置文件exact read-data/metadata/test；/private已具metadata。不授整个/etc或目录data，不创建/编辑配置，不传ignore-managed/空覆盖，不增加Mach/network/Keychain/home/exec。

本机一次lstat-only18:50:10确认/etc为private/etc链接、/private与/private/etc为真dir，两个codex目录与六文件均ENOENT。新固定gate用BigInt身份、readlink及两次parent核对夹住8项lstat；仅ENOENT接受，任何存在（含symlink）、权限/未知或父身份变化均阻止native。入口在预约前和异步R06 import后/同步owned准备前各核一次；后者到spawn间原probe仅同步own根准备，仍不是无竞态OS快照。绝不读现实系统配置内容。若配置之后被管理员创建，采样不能声称硬隔离，保留该限制。

默认Unix loader要求requirements、legacy managed、system config；只有NotFound缺失可忽略，权限错误上抛；macOS另有CFPreferences managed源，本片不探测/不增许可/不重写其结果。具体固定源码、raw行号/hash见upstream-input.json。installed binary/source可复现链仍未证明。

沿已审R06/probe唯一spawn/握手/一页目录/controlled close，1native、最多1model-list20、45s含自动收据/清理/CLI/tool实际exit、1MiB归档输出、两own根前后8MiB样本；active峰值/累计wire/wholewriter/账号unknown。0turn/auth/login/推理/PG/install/个人服务。新namespace13输出，旧窗口不复用。只新gate反例+惰性import/sh必要检查待Mika小窗，旧17不重跑。
