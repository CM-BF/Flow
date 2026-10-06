# O08 独立审查

状态：APPROVED（Root / Goal Owner / gpt-6-astra，2026-10-06 07:01 UTC收到）。
Review target commit: decfcee90264f84ecf3c02874c1e6c85d65bfe13

原实现6b864881a3acb4957ad8482a7bffc71619f2c8d8；原metadata ad6bebf9444cbef66460b7579c2db3aeaa7b93a0；本delta仅detached进程组清理/3个回归/准备边界文档。固定产品base a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8没有变化。

Root P2：原stopWorker在leader退出时跳过整组停止，可能残留SDK子孙并误删tmp。作者用Node24实际三代进程复现红；修复后按PGID存在性TERM/KILL并确认，未知拒绝/保留tmp，并发stop共用promise。作者5/5（3新增+2driver直接消费者）及同一0query真实MCP/HTTP/PG演练通过，原5guard证据沿用；累计11不同，非Root重跑。原始red/green/manifest均保留，见[修复证据](../../docs/evidence/o08/README.md)。

同次记录原生尚未就绪：BASE已有历史3managed plugins+3skills不符合零扩展gate。未探测当前provider，不绕组织设置，不增加query；未来执行按GO既有预算流程。

Root独立只读复审已核完整4文件delta、10source/32raw/6产品依赖的固定/current hash全部吻合，manifest cae8299dfd865fd129973fcb90d7e12b2be4a2dc1a7226ea92adb6e4324638de；现场clean39f5967afcde093366d7f1802c3a5e271b4def2f。P2 CLOSED，无P1/P2；仅核作者分批证据，没有重跑测试或query。独立结论绑定以上完整target。未实际native broker/NL/费用/真实SDK子孙退出，主动脱组未覆盖；测试注入不作语义证明。批准仅0query验收准备；未发模型许可，不自行生成permit。待Lead限定集成。
