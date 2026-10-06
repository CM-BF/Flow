# 唯一窗口失败结果（待忠实性独审）

go-node-runtime-metadata-once **CONSUMED**，执行HEAD761f441c；source26148841、combo e318、全部固定输入未变。2026-10-06 14:34:31 UTC一次调用，实际1 owned target/0compile/0listener/Codex/SDK/provider，第二槽NOT_RUN。工具chunk9cdfc9退出1，wall0.161819791s；pre-call/tool-finish同14:34:31，以+1秒保守界支持60s内完成。内部229.960208ms是结果写前，234.811125ms是写后/CLI前，均不与tool wall互相等同。

槽1code1/signal null，未达到exit7/40B预期；完整stdout0、stderr246B（SHA4aa1b4430000089cc1a025822a34234bb92232ba16fec09a35210c68c48a4fe0），双EOF/直属child/group关闭已确认。有限errorClass/Reason/errno/role均UNKNOWN；不推断Node已运行脚本、具体缺grant或旧R06原因。首槽失败停止，未运行七项canary、无重试/扩权，**measurement FAIL**。

cleanupComplete、retainedRootsComplete、outputAccountingComplete、inventory/result持久化均true，retainedRoots=[]。精确allow-IFwb5K及4个已记私有文件归档时不存在；deny根名未留在safe收据，仅由已审runtime清理回执支持，未扫tmp或猜名。目标私有流finally已删，只存hash/bytes；outer私有207B/0600仍本地ignore，仅读hash/stat，不输出正文、不Git。outer SHA0b3a6c9049fc62e31157cf4b031612727e7f390c1d298bab77a262d357114c2d。

计量：prepared343145 + observed246 + disk17387 + postpersist receipts6464 =367242；CLI2083与outer捕获/磁盘/其他收据639相加为**369964B**。machine batch-result写前receipts3660/known364438是早快照；safe CLI给出写后6464/367242，不能用早快照替最终账。机器收据+CLI8547<32768，outer639<8192；槽2未运行，0上界不代表任何canary实测。

当前人工归档详archive-result.json：与prepared互斥、排除私有outer，保守把归档的安全机器证据再次计费（其runtime原计量不减）。总账=369964+该archive；128KiB尾部与2MiB整体分别核。人工整理/Git在运行时钟外，bytes在此总账内。原archive/preparation是固定历史快照，旧cause/Node/C窗口不改；新结果尚待独审，完整MATURE02启动隔离与实际harness资格仍未交付，无后继运行授权。
