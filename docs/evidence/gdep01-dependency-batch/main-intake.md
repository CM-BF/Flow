# GDEP01 主线接收入口

候选已完成源码、局部及单次真实PG结果独审；现已由main fe26cc936d3d645cd102035a1885394c1a48f680精确接收，当前回执见main-receipt.json。唯一owner b01_bounded_reads / co-lead mika；权威branch codex/goal-dependency-batch。整task开工2026-10-07T22:03:42Z，完整完成以当前status的owner核验时刻为准；下方接收前原事实保留为历史。

产品源 `bcbce5cca9dbe4b8d504e0b06deed40f0039f765`（原product `e1b02772853d08cf1069bc16a8b47b7ca717f633` 未改），实际执行 `850d61376373eb59df8afdf6004ef7dda030bd10`；结果审查绑定 `729093d8c09f512cb3e6152708614baf68bea57b`，批准归档 `f74e10e710a41ceac66de6f4f44c22712e1b8da2`。本入口最终metadata HEAD由交付消息给出，不自引用提交。

## 接收范围与前像

四产品/test叶如下；commands基线前像须由集成者与当前main核对，新三个叶应不存在或做明确同字节核验。证据只取本任务 `docs/evidence/gdep01-dependency-batch` 与 `plans/gdep01-dependency-batch` 已跟踪文件；不复制忽略的供给树、外部node_modules、/tmp或任何私有配置。原closed许可与所有raw仍原件，已消费OPEN许可仅归档历史，不可重用。

```json
[
  {
    "path": "apps/server/src/goals/commands.ts",
    "source": "bcbce5cca9dbe4b8d504e0b06deed40f0039f765",
    "bytes": 13111,
    "sha256": "4752162fbfeebc2b62a912e8faac857b829ad84345ddb762aff9b4720a85ef42",
    "preimage": {
      "commit": "69a71e3d9888c24c8f7c7a5965487f106c065c17",
      "exists": true,
      "sha256": "66fc56ff48c46bd9f9ebaac51614985d9f9dbbeec31cf161011dd1ff3813ba32"
    }
  },
  {
    "path": "apps/server/src/goals/dependency-content.ts",
    "source": "bcbce5cca9dbe4b8d504e0b06deed40f0039f765",
    "bytes": 2658,
    "sha256": "a472ec64b69a84a2ee0c19a80350035cfb8dd57ebebd7673b77b45135f9865d6",
    "preimage": {
      "commit": "69a71e3d9888c24c8f7c7a5965487f106c065c17",
      "exists": false,
      "sha256": null
    }
  },
  {
    "path": "apps/server/src/goals/dependency-content.test.ts",
    "source": "bcbce5cca9dbe4b8d504e0b06deed40f0039f765",
    "bytes": 6988,
    "sha256": "a899a4bc74793903c8ecfb9d1c74303c85f1a5503b12ae0c85c7d25791aa986d",
    "preimage": {
      "commit": "69a71e3d9888c24c8f7c7a5965487f106c065c17",
      "exists": false,
      "sha256": null
    }
  },
  {
    "path": "apps/server/src/goals/dependency-content.pg.test.ts",
    "source": "bcbce5cca9dbe4b8d504e0b06deed40f0039f765",
    "bytes": 10967,
    "sha256": "7e3facdf9b70aaccd418b53514b67fa65a0cd49569d96171e52b22eb07343995",
    "preimage": {
      "commit": "69a71e3d9888c24c8f7c7a5965487f106c065c17",
      "exists": false,
      "sha256": null
    }
  }
]
```

## 验收分列

- 源/局部：db22:13:34Z批准e1b/b5ab；首红1fail保留，16pure通过、commands transitive ES2023 noEmit0。源码职责/四tuple/首错和合法正文界已有独审。
- PG准备：db22:38:30Z批准bcbc/98f3；新增test strict0、collect8/0执行历史保留。
- 单次actual：8选8通过。199项1产品查询/3870 decoded UTF8B；48001与1096576B完整跨界；错误顺序、独立旧SQL oracle、回滚和原loadProject FOR UPDATE两borrower边界通过，EXPLAIN1份。不是吞吐/速度结论。
- 结果：chatui22:50:25Z ACTUAL_RESULT_FIDELITY_REVIEW_APPROVED，0P1/P2；13source/36证据34389B、512input/20alias核符。入口pg-actual-review-ready.json及pg-actual-review.json，不新造一份raw。

commands相对固定69a仅inline helper换同签名import；调用点、执行事务、权限/CAS与最终JSON prompt长度代码逐字不变。已覆盖commands transitive types、真实SQL及原loadProject锁/rollback。真实execute/native/progression端到端与最终JSON16k端到端未跑，不能写成全端到端完成；由Lead在实际集成点按影响完成必要consumer接收。

## 收尾 / 当前权限

本次完整已知RETURN观察22:48:09.320783Z；caller cleanupwall精确值UNKNOWN，DBreceipt22:45:34.309、outer terminal34.364426、后观outerESRCH22:47:04.910696和seal各自保留。preflight/主ownedgroup已终态EOF；marked DB1362819同identity零连接普通DROP+absence，admin/auxclosed；actualscratch按caller同identity移除ENOENT。10外置公开receipt9858B原字节归档，原外置目录SEALED_PUBLIC_RECEIPTS_KEEP/0future；不是所有目录清空。初EPERM与/tmp canonical首次归档断言失败不抹除。

0当前child/PG/listener/待launch。特殊窗口已消费，没有自动重跑权。claim f2442a2f-357e-42d5-bb3d-da1c261684ab v2 ACTIVE/exact6在22:52:17.236558Z复核，停写保留待main接收。归档已在原actual8MiB合法尾额开始；最后入口采用Root新的3MiB前瞻封套，不叠加两个cap，不重开PG段。提交pushclean后STOP。
