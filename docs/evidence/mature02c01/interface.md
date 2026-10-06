# MATURE02C01 固定 Interface

输入权威：CORE ea276572c3c99fb8400808a93efc69ce530d55a4，Mika 2026-10-06 16:26 consumer handoff。受控输入详见 controlled-inputs.json/provision-request.json；不新增协议。

- `FlowClient.claudeMessageSettingsProfiles({after?,limit?}, signal?)`：GET现profiles路径，每页唯一精确 `X-Flow-Execution-Profile: flow.claude-turn-settings.v1`，公有schema严格解析；旧/native envelope拒绝，无fallback。原两个reader不变。
- send在现body一次序列化/同字节解析冻结基础上核optional snapshot与observed。旧身份、文本、revision、context、source校验全部保留；capabilities只增加optional versioned设置描述，不改原false flags。
- enqueue仅携带messageSettings分支冻结body并经现unknown错误边界+新 `decodeConversationQueueAccepted`。核conversation/item身份、整数queueRevision/sequence、waiting/null promotion、时间/replayed、有界UTF8 preview/请求前缀/truncated与exact snapshot。Legacy不新增strict要求；accepted replay是不可变receipt，不要求当前仍waiting。
- requested snapshot复用leaf schema/matcher，observed复用公有final schema；effective.model必须等于observed model或未观察时null。不存在的旧字段不补默认、不从requested填observed。
- CLI `conversation profiles|send|enqueue`：现parseArgs/readJsonInput/FlowClient；input≤131072字节，send限定follow-up，mutation必须caller稳定key。返回接受不称执行；HTTP409保持exit3，usage/schema/input为2，unknown/abort保持4，提示以原key/body显式恢复。

状态所有者不变：调用方保存草稿/intent/key；客户端只冻结请求并校验响应，不拥有新持久FSM。取消只沿AbortSignal终止观察/等待，不能推断服务端未受理；不暗换key/body重试。目录≤100/页、choices≤32、snapshot≤1024 canonicalB沿公有schema。CLI旧O14候选输入逐字保留，实际进展自动scan/PG仍独立待验。

验证：局部纯codec、真实loopback HTTP/CLI，关注变更后嵌套输入与回执错缺、不合法observed、unicode preview、旧协议和O14直接consumer。无真实中心/SDK/provider/browser。
