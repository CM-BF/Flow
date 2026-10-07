# WPF-RELEASE01 review

**状态：NOT_STARTED**

Review target commit：9658a6b763de69038778de1b0c16de64ff824c75

范围：本次固定 public origin / 三 retained App successor 两harness。设计限定接受见[原件](../../docs/evidence/wpf-release01/fixed-origin/design-review.json)；不等于源码或实际兼容通过。后继最终backend为空；f3d源码限定0blocking（[原件](../../docs/evidence/wpf-release01/fixed-origin/f3d-source-review.json)）。唯一strict首红exit2/父exit1保留；当前9658公共类型索引修正未复验、最终delta审未完成，browser/真实compat仍NOT_RUN。固定入口/缺件见[implementation](../../docs/evidence/wpf-release01/fixed-origin/implementation.md)，两源hash见[source manifest](../../docs/evidence/wpf-release01/fixed-origin/source-manifest.json)。

必须核：真实Chrome页面请求和Node APIRequestContext分离；exact proxy/Host与无fallback；原Bearer+独立Cookie补证；SSE与真实ACK prefix；原四观察与最终backend/context；owned cleanup、报告与未知失败。

## 历史7805限定批准（不迁移到后继）

历史原件[previous-review](../../docs/evidence/wpf-release01/fixed-origin/previous-review.md)逐字保存，target7805b7dd20b1dda1b24ecb7497b1fca84bc5a63b、mainc450事实不改。
