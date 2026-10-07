# X01-VERSION-LIFECYCLE01 一次真实PG结果

2026-10-07T11:34:20.710218Z内部开始 → 11:34:25.533528Z最终持久化完成，PASSED/exit0；1选1过0失败，未重跑。实际主线产品输入固定cca4，执行HEAD9f447b8f7a3e444b70efeb12ff9b1d082d1f5b45；input manifest59b93fb3…32d9d。唯一随机window c9f68b4fb311419aad5ba87f125c480f，新本次准入不是旧窗口复用。

生产runRunner单实例、capacity2/local2；A真实running、load ACK已持久，尚未import/invoke。select B清config/grants后A新invoke权限被403拒绝且无invoke行/产物；显式配置/授权/启用B，B完成，再放行A按原attempt/pin继续完成；disable拒新任务，selectA/重配/重授/启用后C使用原A材料且新task/binding/invocation。A事件起始前缀实际0，完成后非空事件集合到C后全等。3tasks/1runner/两Flow包装(1.0.0→1.0.1→1.0.0)，同semver7.8.5上游；不称tool函数已运行中升级，不勾整个X01-04。

完整center app hook：100 HTTP、62736B response payload；不是TCP/wire/heap。registry4请求、2次tar下载另计；固定bundle本地组装两次tar子进程exit0，无下载第二upstream。

Git82041与Vitest82082两个owned groups exit0/finalabsent/mergedEOF/observed==retained，无signals/secondary；初EPERM观察保真。tar82610/82611正常close/exit0。DB OID1300235和原marker/owner核符，0连接普通DROP ACK+absence，runner/server/registry/pool/admin closed；动态loopback61402/61408 closed。TMPdev16777234/ino124098576末样本60项85389B，同identity正常删除，11:34:41.853508Z owner精确lstat ENOENT；末样本不冒实时峰值。retained[]/retainedDBnull/errors[]，实际窗口已立即归还。旧他task KEEP未读取/未清理。

内部after-persistence4.823525334s、外部/usr/bin/time4.90s、工具最终exit0分别记录；只与本180s窗比较，无性能提升/吞吐结论。freshfree22,011,535,360B，caller实际floor6,190,268,416B，paired4,947,705,856来自新manager完整policy floor，补足不冒测量他人usage。

结果尚待固定独审；未集成本验收metadata到main，不将本单例批准推最新main全部能力或真实OS runner/model。
