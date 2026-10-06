# ENG01F 可审证据

4新私有源码/测试。capture41行、receipt50行，复用ENG01E有限checker、现受管workspace.snapshot、readTextFile、canonical snapshot/digest和runtime身份。旧workspace/checker/profile/runtime/shared contract零改。

| 验证 | 实际结果 | 原始进程输出 |
| --- | --- | --- |
| 自有WT Node24.20.0/pnpm9.15.4 frozen offline install | exit0 | install.json / install.stdout |
| receipt/capture显式局部 | 20 passed = receipt9 + capture11 | local.json / local.stdout |
| root noEmit | exit0 | types.json / types.stdout |

原stdout直接由实际进程保存，JSON含命令/起止/exit；local.json记录4源当轮bytes/SHA。没有失败需修复轮次，没有PG/provider/native app-server/auth；未重跑旧68或更早工程套件。实际Git使用现固定/usr/bin/git资源模块，仅在本例新创建的合成repo内操作。

11个capture用例各自新建受管project/workspace与临时root；afterEach等待lease.release→project.dispose→root移除，所有20检查通过意味着这些清理await完成。actual-host用例也等待runner结束与自有动态端口HTTP server关闭。没有把主动测试清理当作产品在unknown时自动release：测试在调用后检查project仍被租用，随后受信测试owner统一收尾。

覆盖：正常受管Git diff与source绑定、合法错误算术failed；未跟踪额外文件完整收录、删除/可执行模式/2049字节源码拒绝；before快照后内容改变只产生unknown、after阶段新增文件只产生unknown；注入ownership失效和pre-abort没有收据且不释放。缺身份在任何snapshot前拒绝。实际runRunner通过真实本地HTTP claim取得center-task/center-attempt/runner/ownerVersion，capture绑定这些宿主事实；随后受控unknown异常保留admission.json和workspace租用，不发artifact/verification/completed。未把此HTTP fixture说成PG或native执行。

收据独立flow.calculator-workspace-check.v1，writerSettlement永为not-attested，旧flow.engineering.receipt.v1 parser明确拒绝。完整files/canonical before=after、diff SHA、限定source、真实身份结构与report均受验证；codec通过同一ENG01E解释器重算fixed report，不接受外部伪passed/自报stopped，返回深冻结内容。source≤2KiB、diff≤262144B、JSON≤512KiB；正常样本断言<10000B。不是通用JS执行器、旧command receipt或中心成功凭据。

取消/资源：每个awaited观察阶段前后调用真实ownership/abort端口。已进入的workspace.snapshot仍由其现有Git命令界限负责结束；本片没有Promise.race丢弃后台命令，也不宣称即时中断借用的workspace操作。产品新增无timer、queue、network或child，实际测试Git进程由既有受控runCommand等待结束。局部capture11例总4.232s、receipt9例18ms仅为本机样本，不据此宣称系统性能。

前后snapshot一致只是此次观察一致，不能证明后台writer已经停止或观察后不会再改。未来host必须先通过独立可信lifecycle owner建立停止依据才调用capture，unknown不得检查/释放/新claim。本片输入的受管handle和host身份仍依靠同UID受信配置；共享Git refs/config/.git必须由未来native策略保护，不能把worktree lock当OS沙箱。真正native文件写入、模型资格/预算、完整停止、独立actor接受及中心新版receipt仍待后继，绝不用host-applied替代验收。
