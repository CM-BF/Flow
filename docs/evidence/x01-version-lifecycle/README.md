# X01-VERSION-LIFECYCLE01

唯一status：../../../plans/x01-version-lifecycle/status.md。固定main cca4ab7c968598844ca5680140ee7c06ec1dd2f4，新增一条真实PG case，当前仅types/list，PG NOT_OPEN。生产源码无改动。

A在生产runRunner真实load ACK后暂停：installed材料已核、attempt running，尚未import和invoke。中心capacity2与本地maxConcurrentAttempts2一致；一个真实runner允许B完成。显式transport委托四个真实pluginRunner方法，gate保原ACK且听原AbortSignal（requestTimeout45s，整体work110s）；afterAll无条件release+abort然后drain。它不是函数已执行后的升级，也不证明真实操作系统runner进程部署。

register B增revision不切换；select B清配置/grant，先对A新的invoke authorization确认403/no invoke receipt/no artifact；显式configure/grant/enable B后B完成再放A。A当时新获invoke授权但保原binding/material/config/attempt。disable拒新任务；select A再次清配置/grant；明确重新配置授权启用，新C使用A材料、新task/binding/invocation。A事件可能初始为空，保当时前缀；完成A后全事件冻结到C完成不变。

本片复用已有semver7.8.5固定bundle，改包装package.json版本形成两个不同tar/tree；不下载上游、不称npm升级或完整X01-04完成。真实HTTP仅loopback自有registry+center；rawJSON/code没有用户token。

local：types首错9条（缺既装依赖入口引起）保留，补8入口后types0；collect恰1非pass；静态修空事件前缀/补同attempt后finaltypes0。历史test精确25f898…690c保存fixture-local-v1.txt；最终target独立绑定。4children累计8009ms、raw1296B，全部最终owned absent/merged EOF/完整bytes/no signal-secondary，4TMP同inode有界空采样清理；最初EPERM历史不抹除。elapsed只监督，不是whole-tool wall。

准备caller由fixed0bf7最新host-candidates-pg-once派生，复用原OPS14与X01资源helpers；只改domain paths/branch/claim/selector与保守floor，没有第二supervisor。final receipt后deadline独立delivery保留。source/dep清单与实际输入manifest固定后直接供独审；本README不授运行。
