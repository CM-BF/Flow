# CTX02：真实Pi hook的零模型对照

固定Pi0.85.1 + billion-context-pi0.1.83，复用已验证的临时依赖。需要macOS sandbox-exec与Node24。具体路径、官方tarball/hash、license、原始失败及隔离限制见[方法/证据](../../docs/evidence/ctx02/README.md)。这不是产品安装器。

```sh
/opt/homebrew/opt/node@24/bin/node experiments/context-pi-hook/run.mjs /tmp/ctx02-new-default.json default
/opt/homebrew/opt/node@24/bin/node experiments/context-pi-hook/run.mjs /tmp/ctx02-new-factory.json factory
```

仅运行其中需要的一条，不为了重复数字同时跑；输出文件必须不存在。默认入口在精确读白名单下被拒；factory是另获批准的显式SDK资源注入对照，没有伪造ExtensionAPI。无模型调用，但不会因启动器退出0就判通过：查看child.outcome与cases。每child限20s、所有原始材料<=1MiB、禁止无限重试；依赖路径缺失就停止，不自动安装。不得修改HOME/白名单或关闭隔离让它通过。
