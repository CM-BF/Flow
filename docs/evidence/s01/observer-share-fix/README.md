# S01 observer FOR SHARE精确分类后继

本片仅实验私有observer一条精确SQL分类修正，**不是新的容量结果**。已审128结果64911a3c/执行70c/原source6de与raw/manifest保持Git固定，本片不回填其UNKNOWN、不重跑或重新归类历史other。

固定P04生产SQL是 `SELECT id,revoked FROM flow.runners WHERE id=$1 FOR SHARE`。旧observer误匹配SELECT *，本片只将那个精确常量替换为实际两列查询；没有扩大regex、输出SQL/参数、改产品或改变pool/锁/生命周期。

新反例从当前固定main1c的runners.ts读取实际SQL，通过fake Pool→observePg→真实query装饰Interface执行，核share分类、旧假定SELECT *保留other、exclusive分类不变、其他表仍other；记录中不出现SQL。原3项promise/callback/receiver/error身份透传断言完整保留。

[red](red.stdout)/[stderr](red.stderr)真实4选3绿1红；最小改动后[green](green.stdout)4/4，3原直接+1新，不与128准备41或真实任务数相加。[checks](checks-receipt.json)及局部strict exit0。全程fake/本地读取，无真实PG/HTTP/runner/SDK/provider或新窗口。

clean-code于本次checks时间自审：Module/Interface保持observePg不变；只修精准分类知识，真实消费者形态作为独立反例；无新抽象、重试或全局副作用，finally恢复fake装饰。使用此前本地find-skills/clean-code/codebase-design与本轮tdd；controlled clean-code来源/固定版本沿mixed-128-preparation/skills.json，未安装更新。源码/证据独立target待Mika审，不沿用64911approval。
