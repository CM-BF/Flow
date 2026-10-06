# R06 Codex native transport — 有界合成验收

固定产品目标 **a239b14d5328c78cca02a8757e26f2b65502f926**；基线 3d31ba89bc3696e64d15f12f9d8c703e4d7bd914。来源 [provenance](provenance.json)，小 [Interface](interface.md)，[质量记录](quality.md)。

## 实际检查

Node24 / installed pnpm9.15.4 / Vitest4.0.18。只用已安装依赖与自己的 Node stdio peer；没有启动 codex app-server、读取 auth/token、网络/provider/模型请求、PG 或个人服务操作。

- `pnpm exec vitest run apps/runner/src/codex.test.ts`：最终 [31/31](transport-verified.txt)，1.846s；早轮 1/20/26/27/29 与定向 red 均是同一组演进，不累计为额外 distinct。
- `pnpm exec tsc --noEmit`：最终 [exit 0](types-verified.txt)；空 stdout 正常，exit 另存 checks.json。没有包级假 test/typecheck script。
- handshake-red 是明确未实现行为，不是 module missing。JSON data 丢失、unknown 并发释放的行为 red 也保留。
- 每个测试 afterEach await 所持 transport.close 并断言 confirmed-exited，然后删除自有临时目录。所有最终测试包含清理断言；未扫描/杀他人进程。

公开行为覆盖 initialize/initialized、ready 前拒绝、三请求逆序关联、重复/迟到回复、16 并发 pipe 请求、每 UTF8 byte 分片中文 emoji、非法 UTF8/JSON/ID/EOF、双向 byte/frame/请求配额、unknown 不释放远端额度、write callback/drain 背压、排队 not-sent 与已发 unknown、server request 显式答复/防重复、环境/错误/stderr 清洗、abort、退出码7、TERM忽略→KILL、自有 spawn 失败。

## 测量口径与边界

合成 pause peer 下 900k+100k 两帧写队列峰值 **1,000,092 bytes**，受 1,200,000 byte / 2 frame 配置约束；第三请求拒绝、排队取消未发送、active write deadline 关闭后 queue/pending/unanswered 归零。只测客户端提交/持有字节，无 provider吞吐/CPU/RSS/首token/费用结论。

本模块复用 env 白名单和 owned child 原则，未复制现服务管理器/agent loop。只确认直接 child，未对 fork 后脱离的进程树或任何远端副作用作停止承诺；传输不是 OS sandbox。未知请求由 consumer 处置，绝不 hidden retry。生产登录来源、model/turn/settings/approval 映射和 Flow adapter 挂载均是 R05B/Mika 后继。真实 Codex conformance **未执行**。

## 重跑

在本独立树，使用 Node24 和已安装依赖运行上面两个明确命令。测试只启动 `apps/runner/src/codex/fixtures/peer.mjs`，不读取真实 credential 路径。无需安装/数据库/外部网络。
