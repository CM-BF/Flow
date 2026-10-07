# GDEP01 局部结果

2026-10-07。固定产品base69a71e3d9888c24c8f7c7a5965487f106c065c17；原逐项读取红例commit3c0697986dfd9456d8afbf322004b97dbd360270。

| 执行 | 实际选择/结果 | 监督耗时 | 资源 |
| --- | --- | --- | --- |
| red | 1 selected / 1 failed：期望1次query，原实现2次；正文一致 | 458ms | PID76915 exit1，finalabsent/完整EOF/自有TMP已删 |
| green | 16 selected / 16 passed | 419ms | PID34301 exit0，同上 |
| types | root ES2023继承，本module test+commands直接consumer传递闭包，noEmit exit0 | 1484ms | PID45082 exit0，同上 |

3工程child累计2361ms，不是整段墙钟；最后FULLRETURN2026-10-07T22:09:02.082248Z。原始日志和单份iterations.json保存首红、各次actual sourceHashes、fresh组合floor/free、观察/首错与cleanup。初始只读EPERM观察保留；最终ownedabsent/EOF与首错误独立核。0PG、0HTTP、0provider、无依赖安装。

## 实际覆盖与限制

16不同纯行为覆盖零依赖零query、两项及199短项单query、输入顺序/重复/四tuple参数/metadata不变、独立16BUnicode摘要vector（CRLF/反斜杠/组合符/nonBMP）、空正文、UTF16等值与累计上限、缺失/hash损坏/当前大行与后项错误优先级、截断/misorder拒绝、DB错误原样不重试。fake query只验证查询次数与JS行为，不解析或执行SQL，不能证明SQL使用索引或真实返回上界。

真实SQL/EXPLAIN、完整JSON prompt在真实execute中等价、实际项目锁等待与并发、PostgreSQL累计prefix字节边界仍NOT_RUN。后继真实PG应使用动态专库/端口、新资源授权；不复用其他feature窗口。候选SELECT元数据含全部<=199行的octet_length，正文只取选中前缀；不声称PG全文工作量或速度改善。48000+1MiB正文返回界仅在现有合法artifact<=1MiB输入前提成立，非任意损坏DB行硬cap。单语句快照替代多语句READ COMMITTED，不改变transaction/project锁所有者。

## 清理与供给

483固定Git供给3280152B（含33 storage路径，SQL作为未来影响输入，当前未运行migration）。逐blob核查只commands.ts有合法产品修改；新helper/test另受claim。Node24实际/opt/homebrew/Cellar/node@24/24.20.0/bin/node，Vitest4.0.18，TypeScript5.9.3；pnpm9.15.4已装但本段未调用。17外包alias为既有只读runtime，三个@flow alias与types paths均本WT；没有moving main内部包运行输入。

阶段预算8MiB包括本树固定供给、worktree管理、源码/evidence/raw/TMP；22:10观察tree3379524B+management2287782B=5667306B，额外一次index原子副本和128KiB收尾估计8085256B<8388608B。TMP只在自身marker/devino相符并进程闭合后删除，结束均exactlstatENOENT。未释放claim；供给持久存在不宣称磁盘回收。
