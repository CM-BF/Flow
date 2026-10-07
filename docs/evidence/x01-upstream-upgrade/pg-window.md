# X01 upstream center acceptance — NOT_OPEN

唯一入口：Python3.13 -B docs/evidence/x01-upstream-upgrade/execute-pg-once.py --admission <fresh absolute path> --sha256 <exact SHA256>。当前没有admission，没有执行，pg-run-r1必须不存在。

固定基线62e9a83923a3c2996b4ab32610e10e2069828c66，同树server/runner/client与旧lifecycle source201674f49b538917f6f46cbdb02da4ed65191d02的公共旅程。只换材料为已审真实semver7.8.4/5 range bundle、registry身份及false/true/false期望，保显式register/select/config/grant/enable和phase拒绝/旧pin/events/cancel cleanup。A实际running/loadACK后、import/invoke前gate；不是工具函数执行中升级。单in-process runRunner，不是OS runner/model。

拓扑：1专DB、最多17连接；center+registry两个127.0.0.1动态listener，2个/usr/bin/tar子进程，Vitest含worker、esbuild service可能由既有transform启动，所有归唯一监督group；另一个Git preflight group。1runner中心capacity2、本地并发2、3task/attempt/1registration。0provider/native/Chrome/共享服务动作。

一次新180s=110work+60cleanup+10final；32MiB TMP/4096条目、1MiB raw、128MiB DB/WAL保守预留+一份1GiB收尾reserve。center256HTTP/4MiB app payload、每response128KiB，registry≤8/2tar；payload不冒TCP/heap。caller最低6,190,268,416B与fresh完整组合取高，所有旧KEEP/普通有效声明继续计，未知无上界HOLD。claim5e6eba8c-5838-42c5-9455-f5112ca05e47 v2/5与freshledger≤60s、cleanhead、manifest、35external/20links、随机32hexwindow、pg-run-r1absent等原gates照常。

新源types首轮0但@flow路径误指旧WT，不纳当前证据，原config/raw保留；纠正same-tree后focusedtypes0，Vitest list精确1，仅collect/0hooks。0actualPG；不复用旧已消费lifecycle窗口。对新prepare独审后仍等经理唯一实际NEXT/OPEN。
