# WPF-RELEASE01 review

**状态：APPROVED**

Review target commit：7805b7dd20b1dda1b24ecb7497b1fca84bc5a63b

Base：8d8ab520a9d43c7b9dafb22911416ee799ebf665

独立 reviewer：/root（gpt-6-astra / ultra），2026-10-06 10:46:30 UTC；本记录由owner原样归因转录。范围：两个测试脚本及其固定兼容证据；不是个人发布批准或全部产品兼容。

## 独立实际检查

完整阅读2脚本与SVC verify接口。Node24定向tsc exit0，原始[日志](../../docs/evidence/wpf-release01/independent-typecheck.log)。独立[raw/artifact审计](../../docs/evidence/wpf-release01/independent-audit.json)exit0：2source=target=run hash，8checks/report原字节hash，旧新各24wire、2POST同key/body/turn、真实协商/legacy；两manifest各10files由保留artifact verify重验，loaded10/5逐字匹配，sourceTree/lockDigest与gitobject一致，自有checkout确已移除，protected diff0。目视new light/dark390，侧栏覆盖限制与作者说明一致。

0 blocking；没有需修P0–P3 findings。早期非正式检查提出cleanup、console门禁、format2要求均已在固定实现纳入，未把它们伪作某个正式拒绝target。

## 作者检查与未验证

作者真实浏览器两旅程及局部tsc/cleanup见[README](../../docs/evidence/wpf-release01/README.md)和[source-manifest](../../docs/evidence/wpf-release01/source-manifest.json)。root未重跑浏览器/PG：DB删除以作者cleanup为据，未独立查库。没有全故障注入、真实模型、个人发布或全产品兼容结论。390侧栏打开截图不是完整窄屏UX验收。

发布条件：严格固定new format2 releaseId `8d8ab520a9d43c7b9dafb22911416ee7` 和已测完整descriptor/manifest相同；不能仅相同source SHA复用。源码后续改变须重新定target。此次metadata提交不改变获审两源码。

入口：[plan](plan.md)、[status](status.md)、[quality](../../docs/evidence/wpf-release01/quality.md)。

## 主线接收

2026-10-06 10:56:51 UTC，owner只读核固定main `c450c2da7e6185b88db9f46e0299ee504ee6f3e8` 已接收两源码，target/main/current逐字相同；[记录](../../docs/evidence/wpf-release01/main-source-observation.json)。原实现及批准metadata SHA并非该main祖先，不把源码接收冒称原commit合并。原APPROVED目标不变。未重跑产品检查，也不表示个人入口已发布。
