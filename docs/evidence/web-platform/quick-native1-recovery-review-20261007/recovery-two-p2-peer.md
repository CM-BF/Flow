# Recovery 0141 两项 P2 独立同行复核

固定 target `0141cf4f23032ce206b7eaf0a19729c966ca4751`，base `84005a260dfcb668cd38b09c21564d0754a0f513`。只读 Git blobs；未运行 Node、测试、模拟、浏览器、PG，也未读取 moving 修复。结论：两项均成立；没有发现现有保护能否定所述控制流。

## P2：同一 authority 的后台 ready 可撤销显式选择中心

`App.tsx:1226` 持有 selecting；`:1232–1239` 的 focus/pageshow/visibility/BroadcastChannel 可触发 read。`connection/session.ts:58–64` 每次 ready 都创建新的 identity 对象，即便 namespace/CSRF 未改变。于是 `App.tsx:1242–1256` 的 identity 依赖变化会重跑 effect；同 namespace 不进入 retainedGuard，随后 authorized(identity) 成立并在 `:1253` 无条件 setSelecting(false)。其 current guard 与 authorized 是旧结果/authority 保护，不是 chooser intent 保护。

具体路径：用户从保留 Workspace 打开中心选择（`:1274`）→在 Connection 的本地 url/token 中编辑（`:1160–1161`）→同中心后台 read 成功→ready 重新变 true（`:1259`）→Connection 条件分支消失（`:1271`），编辑随卸载丢失。现有身份值相同也可触发；不要求 namespace 切换或授权丢失。此为源码可达性结论，未实跑浏览器。

## P2：存储屏障成功跨过 timeout 可留下无法重试/恢复的 sending receipt

`conversation-steering/control.ts:252–258` 设置 receipt.phase=sending 并建立 15s signal。`:266–268` await recovery.prepare/dispatch 后，signal.aborted 且 generation 未变时直接 return；这不进入 catch。`:276–277` accepted checkpoint 成功晚于 deadline 同样直接 return。finally 只清 this.sending 并 publish/refresh，没有把 receipt 的 phase 终结。

实际 recovery 接缝 `recovery/binding.tsx:250–291` / `recovery/journal.ts:155–185,208–220` 包含不接 Steering AbortSignal 的异步 chain/IndexedDB transaction，因此控制器自身没有排除此晚成功路径。严格限定为屏障**晚成功**；若其 reject，通常进入 catch 更新 unknown，不应混称所有慢存储都必然卡住。

后果：retry (`control.ts:247–251`) 只接受 unknown；restore (`:128–139`) 拒绝已存在 sending；refresh (`:224–226`) 仅合并已有 receipt.command，不会给该 receipt 补 command 或改 phase；clearResolved (`:287–292`) 也不清 sending。accepted checkpoint 路径即便 journal 已 accepted、commands map 已 merge，receipt 仍无 command，因此同一 controller 的正常 refresh 不解卡。保持原 key/事实恢复的语义需由 owner 修正，不可把已持久 accepted 降级后再发。

## 测试边界

现 `conversation-steering.test.ts:36` 覆盖 hidden 引发 generation/abort 的 unknown 路径，`:39` timeout case 仅 admission HTTP/read gate，并不覆盖成功存储屏障跨 deadline 且 generation 不变。现 recovery 测试包含 deferred restore、事务完成、失败 handoff、accepted 恢复等；这些不构成 mounted BrowserWorkspace chooser 或 Steering 上述 deadline 的反证。旧完整七组实际证据保持历史，不当作这两路径覆盖。

方法复用已读本地 find-skills / clean-code / codebase-design：检查 authority 与 UI 意图责任边界、异步成功/错误终态、真实接口与现测试覆盖的差别。未提新增通用框架。Quick 源/包/usage 未触动。
