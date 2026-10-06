# WPF-ATTACH01 Review

**状态：NOT_STARTED**

Review target commit：UNKNOWN

Base：f181d84b5fb3652d62e2a181acff442d42b3e066。当前phase1只允许两个合同源与一个pure专测，不包含runtime或已实接能力。

独立审查入口：先核本worktree/branch/HEAD/dirty，再按status target读取diff与checks source hashes；明确旧template1 wire兼容、附件v2严格identity/顺序/bytes、cap与namespace不是权限、unknown lookup语义、无未授权共享出口修改。只运行显式attachments.test.ts及必要typecheck，不用0tests或空模板代表通过。

已执行独立审查：无。Blocking findings：尚未审查。真实HTTP/PG/浏览器/provider：本phase未执行。
