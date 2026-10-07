# 新恢复后台 b692 的四 App 兼容准备

源码 `203ccc2f38d45ee043838383d3ba3056e7e4a435` 仅更新 fixture 中三个可信后台身份字面值。新后台为 `f37a3612068c7215994750574a7451ede841bcce` / `b69296ade85aa19a767a28ab53a25ddd7e37841538f0120b346bc8f03f45810d`，tree `de843e0fda82600b4d7600c76614c9794c17e3af`。固定 producer target `5938b9d647e459854a181e9fe08ee4024228da3a` 的 [descriptor](result-descriptor.json) 与 [result manifest](producer-result-manifest.json) 已逐字核对；未重扫全部 artifact payload。

[fixture 差量](fixture.diff)、[输入差量索引](delta-index.json)、[单次后继提案](proposal.json)。私有候选 `/private/tmp/rel01-b692-c1`：parent、worker、measure、tsconfig 四文件逐字复用已审 C3，caller.diff 为0字节。74 pins中未变native/dependency/assets复用原固定哈希，后继actual必须全部fresh核验；8 imported backend入口及3池配置文件重新绑定新root，八入口字节与旧cd27同。

三个原生Bearer旧App461a/caa1/d629与Cookie新App779/c231不重建、不替换。format1无releaseId仍为null。公共context/policy81a8不变；新backend实际verifier、manifest/root/sourceTree/Node、四App独立实际及cleanup后四正式report不可省略。原UNKNOWN→reload→显式同key/body→accepted turn→Cookie SSE→迟到logout/newcookie断言及400拒绝、agent:false全部原样。旧C3四报告仅对cd27有效。

当前 `PREPARED / NOT_RUN / NO_GRANT`，没有gate、admin输入、raw运行目录、Chrome或PG。未来一次180s含30s清理、1markedDB/12配置连接、1Nodegroup+1Chrome、64MiB scratch+128MiB DB/WAL规划+8MiB retained含256KiB outer+1MiB metadata=201MiB仅proposal，须由经理完整组合一次计入及fresh授权。原段余额不转信用。

新claim [receipt](receipt.json) b4d7d7fd-f215-4882-b7f3-2afc133a0365 v1 exact4。当前源码段21:17:11Z开始、21:37:11Z截止，新增8MiB包涵TMP4MiB/raw512KiB；工程检查0，实际兼容0。源与metadata正常封存后四scope STOP保留claim。
