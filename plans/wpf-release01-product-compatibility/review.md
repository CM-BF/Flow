# WPF-RELEASE01 review

**状态：NOT_STARTED**

Review target commit：41276e2ecd154087f66958339d9abfce4d44964c（新后继源码尚未固定；不是待批准的旧实现）

范围：本次固定 public origin / 三 retained App successor 两harness。设计限定接受见[原件](../../docs/evidence/wpf-release01/fixed-origin/design-review.json)；不等于源码或实际兼容通过。后继最终backend为空，所有本次工程检查 NOT_RUN。

必须核：真实Chrome页面请求和Node APIRequestContext分离；exact proxy/Host与无fallback；原Bearer+独立Cookie补证；SSE与真实ACK prefix；原四观察与最终backend/context；owned cleanup、报告与未知失败。

## 历史7805限定批准（不迁移到后继）

历史原件[previous-review](../../docs/evidence/wpf-release01/fixed-origin/previous-review.md)逐字保存，target7805b7dd20b1dda1b24ecb7497b1fca84bc5a63b、mainc450事实不改。
