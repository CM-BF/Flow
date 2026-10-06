# Interface 与实现取舍

`compareImplementation(directory, target, head, implementation)` / `integrationProof(task, mainDirectory, main)`保持原公共行为；每snapshot重新读取dirty/untracked/main。原aggregate、claim来源、status/review判定不变。

内部tree一次`git ls-tree -r -z --full-tree <commit> -- :(literal)<scope>…`读取有效的≤128范围。用完整NUL记录Set去重排序，保留mode/type/OID/path。仅在寻找每scope存在性时取第一TAB之后的路径；字面file相等或目录`scope/`前缀，不能误认兄弟目录。required源缺任一scope即unknown；main侧允许范围不存在并由完整树比较判不相等。

子进程仍5秒、stdout2MiB。只有`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`或`E2BIG`并且多scope才丢弃partial输出、串行二分。最多255次尝试/深度7（128scope全部失败的上界），单scope失败仍unknown，普通Git错误/timeout不回退。此为每子进程界限，不把理论最坏总运行写作5秒；不无限放大buffer。

模块职责单一：隐藏批次读取和尺寸回退，调用者无新参数。没有跨快照缓存/额外export/通用调度器。测量脚本仅在自有evidence运行临时仓库，生产不依赖它；新增后续策略仍在这个内部seam而非复制proof逻辑。
