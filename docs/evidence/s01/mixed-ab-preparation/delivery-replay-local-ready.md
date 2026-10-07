# S01 delivery replay：当前局部结果与后继入口

2026-10-07T14:56:51.621Z。源码 **d28166e81bcdbb9fb537b40144f7be07a2539130**；局部执行 **9365f91a8aba12aea17dd19710343edb382dc5c8**。db源码窄复审APPROVED，原唯一P2 CLOSED；本结果待一次独审。claim508f v3/full6继续持有，source STOP；**实际replay NOT_RUN_NOT_OPEN**。

## 本次实际范围

单记录 `delivery-replay-local-segment.json`：caller4/4、固定TS5.9.3 strict/noEmitOnError编译0、直接TS8/8；三项首次实际运行，没有重复旧11/9/6/3或64。3顶层child及same-PID exec，全部exit0/ownedabsent/MERGED EOF/无first-secondary-signals；三自有TMP同inode采样后删除，owner14:55:01 exactlstat ENOENT。raw633B完整保留，初始EPERM观察保留。supervisor累计1327ms、time-p三段0.54/0.96/0.86s、工具各wall/秒级UTC分列；wholeexternal段wall/activepeak UNKNOWN。每次outer真实exit0后才起下一mode，未用pre-persistence快照代实际完成。

## 固定输入与生成物

- 原input-v2 SHA `bf9127870db0d9d14087d679fea1eba4c5e217f440650665f6d376c9af1b0615`，62bindings18471479B，运行前逐hash核符；旧input/旧18bindings/trace不改。
- `delivery-replay-js-v2/manifest.json` SHA `cf4fba750a7ea148398efe95c392d8cbf66154b9668eabbe45d0b345b7bcfdfb`，6JS+ESM package39381B。实际compiler argv/source/compiler/input绑定和compile资源收据齐全。生成物静态imports闭包只有Node builtin+六JS；未运行其实际replay，不冒实测3Node或吞吐。
- actual入口仍固定operator；新built manifest SHA必须作为末参数。未来执行HEAD用本包封存后clean exactcommit，原input仍核原source；不能moving HEAD替换授权。

```sh
/usr/bin/env -i FLOW_S01_REPLAY_OPEN=s01-observer-delivery-replay-once:replay /opt/homebrew/bin/python3.13 -I -B docs/evidence/s01/mixed-ab-preparation/delivery-replay-operator.py replay <FUTURE_EXACT_CLEAN_EXECUTION_HEAD> bf9127870db0d9d14087d679fea1eba4c5e217f440650665f6d376c9af1b0615 <FRESH_MANAGER_FULL_FLOOR> cf4fba750a7ea148398efe95c392d8cbf66154b9668eabbe45d0b345b7bcfdfb
```

本命令未授权执行。新replay五outputs仍absent；需要独审接受后单独明确60s/32MiB独占诊断窗口和fresh完整sum/身份/输入/outputs。原caller whole60/work45+TERM2/reap3、unknownKEEP、phase/ordinal/64KiB完整JSON、两arm语义等价和收齐/drain不变。它比较同2048轨迹下完整交付策略成本，buffered含聚合与不同信息粒度；不是纯IPC、wire字节、原pool原因、128容量/SLO或提速保证。

普通段于14:55:01实际RETURN，无PG/HTTP/provider/Chrome/待launch；新授权在14:52:51起，旧source-only快照与预算历史不回写。总新增16MiB及source/meta512KiB+trace2MiB分账见local质量记录。旧43MiB不重读、旧KEEP不访问。未来ordinary/replay不得根据本次资源回执擅自重开。
