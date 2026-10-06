# B03 保留全文校验的有界聊天预览

实现 target `9b2156d1b3481643bc5abd01241831e8c7f4dbdf`，base `e802854f346a81749efdef3f36737b16141b98ef`。聊天 typed 回复现在由PostgreSQL现时计算全文UTF8摘要，只把前缀传给页面读取层。现有全文接口、来源身份、有效设置、pending/成功门禁和legacy artifact路径保持原行为。

在同B02数据形状的50turn×128KiB正文页，数据库decoded rows JSON从6,655,040 B降为555,990 B；HTTP正文仍454,512 B、252 SELECT+2事务语句不变。短正文每turn额外92 B为摘要/标记的JSON包装。这里只证明传输到Node的解码结果变小，**不声称PG wire字节、CPU收益或稳定提速**。

| turns | 单正文UTF8 B | decoded rows JSON UTF8 B 前→后 | HTTP正文UTF8 B（前后相同） | SELECT +事务 | PG全文hash次数 | after首请求 ms | after后续p50/p95/p99 ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 256 | 2,581 → 2,673 | 2,460 | 7 + 2 | 1 | 8.30 | 4.14 / 4.96 / 5.14 |
| 20 | 256 | 45,849 → 47,689 | 43,132 | 102 + 2 | 20 | 22.90 | 19.61 / 21.40 / 22.38 |
| 50 | 256 | 114,197 → 118,797 | 107,362 | 252 + 2 | 50 | 43.79 | 44.56 / 112.14 / 248.59 |
| 1 | 131,072 | 133,398 → 11,417 | 9,403 | 7 + 2 | 1 | 18.77 | 15.11 / 21.07 / 24.90 |
| 20 | 131,072 | 2,662,177 → 222,557 | 181,992 | 102 + 2 | 20 | 139.52 | 32.90 / 146.34 / 164.18 |
| 50 | 131,072 | 6,655,040 → 555,990 | 454,512 | 252 + 2 | 50 | 68.51 | 71.99 / 78.60 / 80.49 |

每组首请求+20后续，共126真实HTTP；首请求在播种后，非PG/OS冷缓存。nearest-rank p99即n20最大值。一次after实际2026-10-06T05:02:26.740Z→05:02:33.242Z，6.502秒、exit0。共享主机、JSON sizing/hash观察器、固定测量顺序造成波动；长1/20组after部分延迟比baseline更高，不能由这些样本推出CPU/latency优化收益，不为更好数字重测。29条窗口内起始后台SQL单列；不计入页请求查询。原始样本与每请求SQL/bytes/hash：[after.json](after.json)，命令/UTC/exit：[after-command.json](after-command.json)。

## 保持的语义与边界

同一detail SELECT返回`left(content,4000)`、`char_length(content)>4000`及`encode(sha256(convert_to(content,'UTF8')),'hex')`，依然按detail id/task id/attempt id三键读取。JS将现时digest与持久assistant row digest严格比较；缺匹配detail或任何位置损坏仍同`assistant_content_mismatch`，对话映射invalid-result。没有缓存、写时凭据或新增pgcrypto依赖。`convert_to`保留真实文本UTF8语义，不能换成有反斜杠解析语义的`content::bytea`。[PG16内置摘要/编码](https://www.postgresql.org/docs/16/functions-binarystring.html)

PG left的4000 Unicode字符涵盖旧JS前4000 UTF16单元；随后仍执行旧slice4000/删除末尾高代理，`truncated=hasMore || text.length<prefix.length`。未做grapheme切分/Unicode normalization。原始prefix最多16000 UTF8 B，JSON转义、metadata和整个HTTP响应有各自大小，**这不是16KB总响应硬上限**。[PG16字符串函数](https://www.postgresql.org/docs/16/functions-string.html)

新`AssistantFinalPreview`具有text/truncated/settings和完整reference，不带content，不冒充完整AssistantMessage。原`readAssistantFinal`、assistantMessage及conversation owned detail保持全文读取；legacy bodyPreview不变。task/current-attempt/owner/session/knownAdapter/source校验不动；pending阶段仍读取/校验typed settings。PG仍整文转换/hash；Node正文SHA观察为0代表工作移到PG，不代表删除校验。N+1、session整读、legacy成本均未改。

## 行为与资源证据

- **21 preview用例**：首红用例1/1因实际133401B≥20000B失败，HTTP原preview断言已过；最小实现后1/1绿，最终21包含首例（不重复相加）。12参数化空/ASCII/BMP/emoji/UTF16高代理/组合字/ZWJ/反斜杠换行边界用预设expected text/truncated；完整旧reader/HTTP detail作独立全文与reference oracle。另含prefix以后的腐坏、uppercase digest严格拒绝、foreign task/attempt/native session、missing typed/unknown adapter/verification与terminal门禁、late commit pending/settings→success、旧owner/currentattempt、显式preview类型。late sequence不外推完整PG隔离矩阵。
- **22原conversation消费者用例**：本WT原source SHA与旧22相同，生成副本只改相对import及唯一DB/清理。`testBodiesSha256`证明所有原断言正文逐字节不变。generated副本finally删除。包括真实中心HTTP与注入SDK的runner路径，0模型调用。未执行固定flow_chat01/flow_chat02库套件。[consumer-result.json](consumer-result.json)
- 合计43不同用例。preview矩阵与consumer运行绑定产品源，与最终target中3产品/preview.test文件逐字节一致。consumer首harness拼接多一括号导致Node解析exit1、0tests且未建DB，诊断保留；修复后22通过。随后按Root只读意见把异常stopServer清理改成finally pool.end，仅异常资源路径，`node --check`通过；未重复22，不宣称注入验证此异常。原测试bodies不变。
- noEmit显式本scope tsconfig exit0，时间/命令见typecheck-result.json；非空测试数量由原日志佐证。harness脚本语法额外检查，不执行其它feature破坏性测试。
- 各自唯一临时DB/dynamic port；preview-red/首绿/21矩阵、consumer及after库均关闭自有连接到0后正常DROP，remaining=[]，不FORCE DROP、不停他人服务。原始资源/cleanup JSON保留，观察器在finally恢复。

## 对照与可复现性

B02固定38b2353结果SHA `ee6ae620eef3fce714d59d5e1b9a4de8f0e8e2d94454cce5b1b0463deeb8b62f`。本次base e802与B02产品base75a的6个测量read-path文件逐字节相同；本次只改变其中store/replies（另assistant/index薄导出）。B02元数据/prompt/session shape/256与131072B含中英emoji正文公式复用，随机ID长度相同。6组HTTP UTF8字节逐一与B02相等；查询数仍5N+2；每组21样本SQL/bytes/PG校验次数字段一致。baseline-reference.json保留必要前值及source hash；原始B02大样本在docs/evidence/b02。

观察器从已审38b2353复制，sha及来源见observer-provenance.json，内容逐字节不变。`fixture.ts`把相同SQL合成数据/实际HTTP/关闭生命周期集中供preview测试和after使用。node_modules仅复用已安装版本，@flow/contracts指向本WT；不改lock、不读取moving main源码。重现命令：Node24 `--import tsx experiments/bounded-preview/run.ts`；外层120秒、内部90秒工作预算，本轮未触发。Vitest4显式preview.test.ts；consumer通过run-consumer.mjs自有路径生成/删除。所有命令在manifest有完整参数。

## 交付限制

内部assistant读取Interface改变，公共HTTP契约/FSM/DB迁移/依赖边界不变；固定架构baseline的内部箭头由Execution Lead集成后同步。Root已于2026-10-06 05:04:57 UTC独审APPROVED固定target；产品已由固定main `da8d73a984118e0a5c406bd04dbfbc5d5c9c148f` 接收，完整9文件scope零diff，见main-receipt.json；原main与常驻运行事实分别记录在status。无执行容量、模型token或CPU节省结论。
