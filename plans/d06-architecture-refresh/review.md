# D06 连线文字背景修复审查

状态: NOT_STARTED
Review target commit: a28e8dac9ab3bd56231c13a0b090e986cc69eb0d
Base commit: cc1f83457f04a02147c854f0503409db1bebb355
Reviewer: pending independent root review

仅 architecture.js 19增4删；原五图data、CSS、direct断言和browser断言均不变。实际bbox集中测量/背景写入，隐藏首屏激活后补测。见[Interface](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/interface.md)、[精确source proof](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/source-proof.json)、[quality](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/quality.json)。新运行NOT_RUN，不把源码修复当页面通过。

首轮5124浏览器失败已完整封存并归还：2/5完成、8PNG、actualexit1；root静态归因既有renderer估宽而非新data回归。原6733累计/余83267含15s cleanup不变，无自动二跑或main批准。

原5124源码与22direct批准及首轮失败记录[原样保留](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/previous-review.txt)；该历史target不覆盖本次renderer修复。原candidate/source-proof为固定历史，不追新审批重写。
