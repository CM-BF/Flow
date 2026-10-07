# ENG01L — 只读 native 与受信单文件工具组合

父任务 ENG-001；本片沿已批准K后继，改变写入媒介为受信host，绝不冒充原fileChange recipe或NativeWriteAuthority资格。

- Darwin profile复用固定J启动recipe的精确展开，新增只读workspace变体；仅private runtime/state可写。旧helper输出保持逐字，不追加fork/network/Mach/sysctl或认证读取。
- prepareDarwinReadOnlyHost只绑定真实目录/binary/sandbox/profile身份并提供单次R06 factory。prepare不spawn；固定app-server、三stdio pipe、experimentalApi，私有HOME/CODEX_HOME/TMPDIR；不暴露额外FD/env/argv权限。
- prepareTrustedToolHost仅组合当前ownership、既有K唯一calculator FD/gate/recipe和上述host。prepare失败仍提供明确cleanup结论；部分资源收尾未知保持unknown。绑定固定task/attempt/runner/ownerVersion/lease/baseCommit/generation。
- close先同步seal，再并行启动通道关闭与真实host I/O drain，保留每个在途Promise。调用方期限只结束观察，不能丢弃真实close。返回child与hostWrite独立事实，nativeWriteAccess永远unknown；不以child close、组absent或注入结果签发revoked。lease仅由原领域根据结果决定，模块不放行。
- 不启动turn/第二loop；使用K异步recipe与现R06 transport。旧G/I/contracts/exchange只读，不mint grant。共享固定startup recipe的现有有限Mach/读资源不扩权，也不声称全IPC封闭。

验证：新profile直接对照旧helper、一次factory/目录替换/关闭前启动拒绝（mock R06不spawn），真实自有私有FD与注入transport组合成功/ownership丢失/部分prepare/取消在途/超时unknown。同一180s过程、16MiB私有tmp、2MiB raw，fresh1GiB+32MiB，0PG/browser/provider/stock；后继真实app-server初始化和OS canary另固定入口，不在本轮运行。

模型資格唯一待决仍在ENG01J。旧locked-no-fallback grant保持拒绝；requested/catalog与供应商实际执行身份分开，未收到reroute不证明绝对无fallback。完整app-server真实工具回调与全部writer撤销尚未验。

实际入口差量（574a2e31）：原 `-p` 的约17.6KiB参数超过R06单参数8192字符限制；改用自有control内 `flow-readonly.sb` 的 `-f`。exclusive0600创建、完整写入并fsync文件及父目录、固定dev/ino/uid/size/mode/hash，launch前NOFOLLOW重读复核；同名存在不覆盖、身份或字节变化不启动。文件在close后仍保留，删除由caller在独立收尾证据后处理，不能称文件删除撤销writer。R06全局限制不改。可选privateStderr复用已有受信sink且maxBytes≤8192，不从task输入扩权。

原a372/6d1已获限定mock独审；真实参数限制是静态直接消费者发现，因此主线接收暂停。3定向例（2新+1原例受影响复测）及types0关闭该静态问题；原16不复跑。准备caller只initialize/initialized，真实stock仍NOT_RUN。
