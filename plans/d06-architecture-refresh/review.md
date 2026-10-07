# D06 连线文字背景修复审查

状态: APPROVED
Review target commit: a28e8dac9ab3bd56231c13a0b090e986cc69eb0d
Base commit: cc1f83457f04a02147c854f0503409db1bebb355
Reviewer: root independent; 0 blocking; APPROVED_SCOPED_RENDERER_SOURCE_BROWSER_FIX_NOT_YET_VERIFIED

仅 architecture.js 19增4删；原五图data、CSS、direct断言和browser断言均不变。实际bbox集中测量/背景写入，隐藏首屏激活后补测。见[Interface](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/interface.md)、[精确source proof](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/source-proof.json)、[quality](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/quality.json)。新运行NOT_RUN，不把源码修复当页面通过。[root固定源码批准](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/root-source-review.json)已原样归档。

首轮5124浏览器失败已完整封存并归还：2/5完成、8PNG、actualexit1；root静态归因既有renderer估宽而非新data回归。原6733累计/余83267含15s cleanup不变，无自动二跑或main批准。

原5124源码与22direct批准及首轮失败记录[原样保留](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/previous-review.txt)；该历史target不覆盖本次renderer修复。原candidate/source-proof为固定历史，不追新审批重写。

[首轮实际失败与清理独审](../../docs/evidence/d06/snapshot-0da/browser-first-20261007/root-actual-review.json)已接收既有renderer归因；第二候选保持原scenario及83267ms剩余额度，[静态准备](../../docs/evidence/d06/snapshot-0da/browser-second-preparation/candidate.json)已获[d528精确包限定审](../../docs/evidence/d06/snapshot-0da/browser-second-preparation/coexistence/prior-preparation-review.json)，不是页面通过或运行预约。当前[并存准入修订](../../docs/evidence/d06/snapshot-0da/browser-second-preparation/coexistence/admission-contract.json)待root审；本页a28e源码批准范围不变。
