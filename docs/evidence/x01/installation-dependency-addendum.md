# X01 安装依赖补充（待 Lead 固定，0 实现）

2026-10-06 12:41:21 UTC。原纵向方向设计 `3bd1add6ef7e868765b4508e88286bd62f49edd7` 已获 Mika 12:40:12 UTC 只读 APPROVED；本页补齐依赖归属，不继承为实现批准。旧 [design-readiness](design-readiness.json) 六项绑定对应原固定 Git，后续 metadata 不倒改该历史 packet。

固定 main `7cbda706632c85fc5da12a371b282419c933ab9a` 的 `apps/server/src/package-artifacts/source.ts:73` 只用 `pacote.tarball.stream`；`storage.ts:61` 校验 tarball/receipt，未解包。server 显式声明 pacote 21.5.1，root/runner 未声明 tar；`pnpm-lock.yaml:3456` 已固定 transitive tar 7.5.22，但这不授予共享模块直接 import。只读已装 pacote `lib/fetcher.js:421–459`：私有 extract 选项会静默过滤 link、改 `.gitignore` 名称/权限，未暴露本片“异常 entry 拒整包、累计展开字节/文件数”完整边界，故不能直接称为已满足的安装 seam。

建议维持 prepare/read 唯一 shared Module 时，为 `packages/plugin-runtime` 正式增加 workspace `package.json`，显式依赖 `tar: 7.5.22`（该固定库自带类型）；通过稳定 package export 暴露 `prepareInstalledPackage` / `readInstalledPackage`。Lead 协调 `pnpm-lock.yaml` 和 server/runner 对 `@flow/plugin-runtime: workspace:*` 的声明。原 workspace glob 已覆盖 `packages/*`，不需另造全局 alias。不引用 `.pnpm` 物理路径、不跨 package 借 transitive dependency、不自写 TAR parser。实际安装/lock 更新需精确 scope 与受控执行；本轮未安装。

库只承担 TAR 语法/流；Flow 仍负责受信 artifact identity、展开流总预算、entry/path/type/duplicate/size 拒绝、精确 name/version/manifest、stage/原子发布/receipt、失败 owned 资源关闭和 unknown 保留。库的 `filter`/`strict`/`maxMetaEntrySize` 不自动等于本片完整限额；实施需真实包、拒绝样本与资源行为验证，不靠 mock loader。runner 只读校验与 import/invoke，不在中心事务执行包代码。

如 Lead 不接受新增 workspace，唯一窄替代是把 extraction 放 server-only 且在 server 显式声明 tar；shared read/hash 模块仅依赖 Node builtin。这会改变已提的 shared prepare/read 职责，需先固定选择，不能为避免 package 注册制造脆弱 import。本页建议前者；当前两条均不是写入授权。

**停用边界**：disable 后拒绝新 binding；已受理 binding 保留 version/config/grants pin。claim 核对 host/store/hostAPI 资格不能顺带把 enabled=false 当作中断全部旧 task。当前调用 grant gate 与 disable 区分；若要求 disable 也撤销已受理调用，需独立固定新合同与并发测试。本片不暗改语义。

只读本机依赖证据：

| 输入（主仓 node_modules/.pnpm 下） | bytes | SHA256 |
| --- | ---: | --- |
| pacote@21.5.1/node_modules/pacote/lib/fetcher.js | 17791 | 97dbf9a402ad3329c517aa35928da4c115a2e3a77b51f513729a8e253ee1144a |
| tar@7.5.22/node_modules/tar/package.json | 7839 | 31b18f4fb83ba7183f54fa9e2cdca610897108c37ba80570c2c6fa7ccf112d97 |
| tar@7.5.22/node_modules/tar/README.md | 52349 | 74be64d36b24666b94a0261bd1b03b789a2c67d189cc02b722b6af161c547365 |
| tar@7.5.22/node_modules/tar/dist/esm/index.d.ts | 945 | 3d4067cbcf736efe67cba7bfe232841b45944da843304ca9ea12f5a316a18c5e |

沿本地 find-skills / codebase-design / clean-code 固定基线：依赖属于实际 Module，命名与单一职责维持；不新造解析器/安装器平台。0 工程测试、0 child/PG/SDK/provider、0产品源码修改。
