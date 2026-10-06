# Root literal：单项bootstrap候选（准备，运行未开放）

GO授权准备既有02-03的后续候选，未来唯一窗口名`go-c-rootliteral-once`。当前claim0dd97484 v5涵盖实验/证据/计划；五个R06路径已交回，只读复用。另一位≥Sol reviewer固定组合审批后，Mika独立fresh门禁并与S01串行，才可执行。现在0编译/0目标。

在已封存sandbox67 profile末尾唯一追加：

```scheme
(allow file-read* file-test-existence (literal "/"))
```

固定[上游6b9826e平台policy](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/sandboxing/src/seatbelt_read_only_platform_defaults.sbpl#L63)有cwd相关root literal规则。仅精确根目录节点，file-read*可包含根目录数据/枚举，不能称为仅stat或没有新增信息；不授予subpath/descendants递归读取；不新增vnguard/sysctl/Mach/私人路径/凭据/网络/进程权限。上游注释不能证明本机必要性、SIGABRT原因或binary归属，旧失败仍unknown。

## 最小接口与唯一recipe

共享entry增加第三固定枚举`rootliteral`，薄entry只调用该枚举；不开放任意profile/path。host/command/parser/report schema、原C、R06与原有预算/清理算法冻结；新C副本逐hash等原C，非独立实现。原v3/sandbox67的sharedentry/test旧绑定是历史Git值，原profile/raw/manifest/archive保持不变。

最多1次clang，随后固定2个自有C目标：无profile socket控制→rootliteral profile regular-file。编译inventory与两流原始bytes先0600/wx/fsync保存后再健康/解析检查；仅本地ignored原流，不console/Git正文。父regular身份不能替代子报告；目标负errno保留合法观测，不称隔离通过。execution/close/group/cleanup/accounting未知就停止保留，不重试或追加grant。无Codex/Node目标、SDK/provider/auth、网络probe、系统日志collector或扫描。

未来唯一命令（本片尚不执行）：

```sh
/opt/homebrew/opt/node@24/bin/node experiments/codex-app-server-conformance/rootliteral/execute-reviewed.mjs --reviewed-rootliteral-window
```

固定source/input/manifest、clean完整执行HEAD、fresh claim v5与外部fingerprints、八个预约/slot/result/raw/inventory路径均不存在，才消费一次窗口。60秒从入口hash到全部自动证据/inventory/cleanup/result持久化/CLI；同步OS IO不可硬抢占，超界照实失败。人工review/Git在时钟外，bytes计入tail。总2MiB包含prepared预扣、capture+raw磁盘副本双计、自有编译产物、32KiB receipt/CLI与128KiB archive；新input/准备清单给实际值，依据上一片closing约21.1KiB，为后续预留至少24KiB。

仅检查新增三项与既有直接消费者，fake command/自有文件，不实际compile/target；Node24惰性import与语法验证不调用窗口。正式结果见checks及manifest。旧窗口绝不补跑，新片不凭历史控制通过推断本次成功。

局部检查已固定：19通过/31未选（3新增+16直接消费者），Node24惰性import0及3语法0；全部fake command/自有文件，实际compile/目标为0。
