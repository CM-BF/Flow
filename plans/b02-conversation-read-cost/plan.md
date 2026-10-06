# B02 聊天 turnPage 读取成本

状态：in-progress；本轮仅有界实验，不改产品。

- [x] B02-01 固定HTTP/PG/哈希测量方法和隔离资源，保留可执行harness。
- [x] B02-02 测1/20/50 turns × 短/长typed正文，分别记录每请求SQL分类、decoded rows JSON UTF8字节、HTTP UTF8字节、hash输入字节及基本延迟分布；首请求与后续样本分开。
- [x] B02-03 真实PG绑定与公开HTTP验证晚提交/终态、foreign/current-attempt/digest损坏防线；清自有资源。
- [ ] B02-04 形成基线结论/局部建议，固定target交独审；产品修复另协调scope。

固定base75a33dec。0模型/云；独立临时DB+动态端口；硬上限120秒、最大50turn、长正文131072B、6组每组首请求+20后续请求。延迟包含测量开销且共享主机，不作为SLO/优化倍数。首请求不是OS/PG冷缓存声明。只在实验进程包装pg/crypto观察，不修改产品文件，不取消digest校验。
