# 同段snapshot调用窄修（未复验）

native2真实页/中文label已可定位；诊断快照把字符串arrow传入Locator.evaluate，实际没有invoke。仅改成真正无闭包snapshotSelect函数，内用for-loop避免序列化helper；所有观测字段/8options cap、原键序/六组函数逐字不变。已装Playwright1.63 coreBundle.js:58399–58400走handle.evaluate，:57797–57800按typeof pageFunction决定isFunction。

独立c2 strict/26direct历史不重跑，也不覆盖新增diagnostic。两次native FAILED原件保留，新段17449/90000、余72551；旧30625封闭。下一包沿相同native/cleanup/acceptance，仅carry两次实际与新source/head，单次≤45s含15s，64MiB scratch/8MiBretained。

TMP最终HEAD在本次metadata提交后绑定，不递归提交；没有自动重用gate。Chrome .99输入变化已明示，不能回推旧.98原因。完整feature UNKNOWN。
