# Removal reference consumer

FlowClient.pluginRemovalReferences(id, { materialInstallOperationId, cursor? }, signal?) returns one checked PluginRemovalPage through the existing owner/cookie transport. CLI: `plugin removal-references PLUGIN MATERIAL_INSTALL_OPERATION [--after CURSOR]`. 64 KiB decoded success JSON / 4 KiB error; at most 40 rows, opaque cursor at most 768 characters. Caller pages explicitly; empty-with-next is legal. Typed stale-cursor 409 keeps the supplied cursor; malformed response is UNKNOWN/CLI4, request errors usage2.

The page covers registration tool-task bindings only; independent snapshots are not a total count. Top registration/install operation matches the request; a reference may have another installation operation for the same physical material. Preserve server order and opaque microseconds. hostRelease=unknown and physicalRemoval=not-authorized remain literal facts: no physical uninstall or release is performed.

Input baseline main3b604; required read-only plugin-removal.ts contract81a is not this feature product and must be integrated before/with consumer. Existing ACK/HOST/C02/READBOUND methods unchanged. Validation is real FlowClient/runCli with mock Fetch, not server authorization/PG/Web.
