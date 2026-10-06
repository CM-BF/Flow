# S01-06 后继：长驻 attempt 的等待订阅界限

本页是既有S01-06的有界缺口登记，0新测试/实验/PG/运行；没有新benchmark大task，旧128结果/raw/预算不变。具体生产owner/scope由Mika在P05交付后协调，本实验writer不包含runtime.ts。

固定main `280289008a5a3779e4e5e6453181b96062ed9514` 的 `apps/runner/src/runtime.ts:55–59` 每轮wait都对timer和所有active promise调用Promise.race，timer胜出只会abort本轮pause。源码与规范给出如下推断：当同一attempt promise长期pending而轮询继续时，每轮race会再次订阅该promise，待决reaction可能随tick累计，当前代码未显式移除这些订阅。

依据官方[PerformPromiseRace](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromiserace) step1.4会对每个输入调用then；[PerformPromiseThen](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromisethen) step9对pending promise追加fulfill/reject reactions。此处是语义与源码推断，不是Node堆、RSS或小时驻留实测结论；现固定6秒128 fixture证据不证明小时驻留内存有界，也不否定其已验证的执行/ACK/清理范围。

后继最小片：fresh核runtime及直接consumer scopes后，独立worktree/branch原子领取，再做小内部wait Module，沿原单admission loop管理有限唤醒订阅，不添加scheduler或容量框架。少量pending promises与有限虚拟ticks先红后绿，直接证明订阅/唤醒有界、attempt完成及时补槽；保留shutdown/fatal、unknown claim保守阻断、正常stop的原deadline drain和recovery等待边界。另复用必要直接consumer，不跑128容量，不用RSS波动代替订阅证明。

当前只登记，未设计最终API、未取得产品写权；不为普通已授权后继额外请求GO确认，也不自动打开A/B或Node实际窗口。
