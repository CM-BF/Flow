# 迟到 Logout：限定验证通过

固定source66caee46（最小生产修复f5ac8dca）通过4selected/4，19未选；1新竞态+3已有直接消费者重叠，不是旧22全套复跑。两次focused types均exit0；第二次仅覆盖接入已有observeConnections后类型。累计7304ms（1753+1872+3679），3轮stdout/stderr共597B。

新真实HTTP竞态在撤销A后扣住其响应，再完成Connect B，最后释放A响应；无Set-Cookie删除、B读写有效、A读/写拒绝、旧SSE关闭、任务仍running。原Origin/CSRF、单session撤销与SSElogout保持。只证明中心合同与自有HTTP/PG组合，不称浏览器Cookie矩阵或当前完整server35已验。

每轮都用OPS14，最终3组absent/双EOF/无signals，pre-reap EPERM保持原件。TMP分别预记录dev/ino，最终计量0B/无子项后移除。PG专库OID1302307/marker匹配；test pool关闭后原main公开observeConnections得到empty/rows[]，checkpoint后normalDROP，数据库removed=true。没有forceDROP、provider或个人服务操作。原fixture只1..28旧基线，main新接收后按必要当前直接组合核，不伪装已部署。

原始结构使用supervision.json/operation-report.json；本派生说明为result-analysis.json，名称不靠大小写区分。运行原件一份，输入按固定Git来源与14已装pin复用；唯一只读observer为main62e9原字节，非新清理框架。不保存凭据、非任务内容或其他目录。
