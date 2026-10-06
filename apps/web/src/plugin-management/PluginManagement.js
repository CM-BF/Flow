import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useId, useState, useSyncExternalStore } from 'react';
import { useRead } from './use-read';
import './management.css';
const PAGE_SIZE = 10;
/** App-owned read view. It never receives or creates a PluginContext. */
export function PluginManagement(props) {
    if (!props.open)
        return null;
    return _jsx(ManagementSession, { ...props }, JSON.stringify([props.sessionId, props.scope?.projectId ?? null]));
}
function ManagementSession({ registry, runtime, scope, scopeLabel }) {
    const [after, setAfter] = useState();
    const projectId = scope?.projectId ?? null;
    return _jsxs("section", { className: "flow-plugin-management", "aria-label": "Plugin management", children: [_jsxs("section", { "aria-label": "Center registry", className: "flow-registry", children: [_jsxs("header", { children: [_jsx("h2", { children: "Center registry" }), _jsx("p", { children: projectId ? `Project registrations${scopeLabel ? ` · ${scopeLabel}` : ''}` : 'Personal workspace registrations' })] }), _jsx("p", { className: "flow-plugin-note", children: "Registered packages, public configuration and grants for this scope. Package code has not been verified or loaded by this center." }), _jsx(RegistryPage, { registry: registry, projectId: projectId, after: after, onPage: setAfter }, after ?? 'first')] }), _jsx(LocalPlugins, { runtime: runtime })] });
}
function ReadNotice({ failed, retry, label }) {
    return failed ? _jsxs("div", { role: "alert", children: [_jsxs("p", { children: ["Could not load ", label, " from this center."] }), _jsxs("button", { type: "button", onClick: retry, children: ["Retry ", label] })] })
        : _jsxs("p", { role: "status", children: ["Loading ", label, "\u2026"] });
}
function Paging({ next, after, label, onPage }) {
    return _jsxs("nav", { className: "flow-plugin-paging", "aria-label": `${label} pages`, children: [after ? _jsxs("button", { type: "button", onClick: () => onPage(), children: ["First ", label, " page"] }) : null, next ? _jsxs("button", { type: "button", onClick: () => onPage(next), children: ["Next ", label, " page"] }) : null] });
}
function RegistryPage({ registry, projectId, after, onPage }) {
    const [selected, setSelected] = useState();
    const load = useCallback((signal) => registry.plugins({ projectId: projectId ?? undefined, after, limit: PAGE_SIZE }, signal), [registry, projectId, after]);
    const read = useRead(load);
    const detailId = useId();
    if (!read.data)
        return _jsx(ReadNotice, { ...read, label: "registry" });
    return _jsxs(_Fragment, { children: [_jsxs("div", { className: "flow-plugin-list-heading", children: [_jsxs("span", { children: [read.data.installations.length, " registrations on this page"] }), _jsx("button", { type: "button", onClick: read.retry, children: "Refresh registry" })] }), read.data.installations.length ? _jsx("ul", { className: "flow-plugin-rows", children: read.data.installations.map(item => _jsxs("li", { children: [_jsxs("button", { type: "button", className: "flow-plugin-row", "aria-label": `View ${item.packageName}`, "aria-expanded": selected === item.id, "aria-controls": selected === item.id ? detailId : undefined, onClick: () => setSelected(current => current === item.id ? undefined : item.id), children: [_jsxs("span", { children: [_jsx("strong", { children: item.packageName }), _jsxs("small", { children: ["Revision ", item.revision] })] }), _jsx("span", { className: "flow-plugin-status", children: "Registered \u00B7 runtime unavailable" })] }), selected === item.id ? _jsx("div", { id: detailId, children: _jsx(PluginDetails, { registry: registry, id: item.id }, item.id) }) : null] }, item.id)) }) : _jsx("p", { children: "No plugins registered in this scope." }), _jsx(Paging, { next: read.data.nextCursor, after: after, label: "registry", onPage: onPage })] });
}
function PluginDetails({ registry, id }) {
    const [versions, showVersions] = useState(false);
    const [operations, showOperations] = useState(false);
    const load = useCallback((signal) => registry.plugin(id, undefined, signal), [registry, id]);
    const read = useRead(load);
    const versionsId = useId();
    const operationsId = useId();
    return _jsxs("section", { className: "flow-plugin-detail", "aria-label": "Registration details", children: [read.data ? _jsxs(_Fragment, { children: [_jsx(Snapshot, { value: read.data }), _jsx("button", { type: "button", onClick: read.retry, children: "Refresh registration" })] }) : _jsx(ReadNotice, { ...read, label: "registration" }), _jsxs("div", { className: "flow-plugin-history-controls", children: [_jsx("button", { type: "button", "aria-expanded": versions, "aria-controls": versionsId, onClick: () => showVersions(value => !value), children: versions ? 'Hide versions' : 'Show versions' }), _jsx("button", { type: "button", "aria-expanded": operations, "aria-controls": operationsId, onClick: () => showOperations(value => !value), children: operations ? 'Hide audit history' : 'Show audit history' })] }), versions ? _jsx("section", { id: versionsId, "aria-label": "Registered versions", children: _jsx(Versions, { registry: registry, id: id }) }) : null, operations ? _jsx("section", { id: operationsId, "aria-label": "Registration audit", children: _jsx(Operations, { registry: registry, id: id }) }) : null] });
}
function Snapshot({ value }) {
    return _jsxs(_Fragment, { children: [_jsxs("h3", { children: ["Registration revision ", value.revision] }), _jsxs("dl", { className: "flow-plugin-facts", children: [_jsx("dt", { children: "Selected version" }), _jsx("dd", { children: value.version.packageVersion }), _jsx("dt", { children: "Runtime" }), _jsx("dd", { children: "Unavailable: package has not been verified or loaded." }), _jsx("dt", { children: "Configuration" }), _jsx("dd", { children: value.configurationStatus === 'ready' ? 'Ready' : 'Incomplete' }), _jsx("dt", { children: "Granted categories" }), _jsx("dd", { children: value.grants.length ? value.grants.join(', ') : 'None' })] }), _jsx("h4", { children: "Public configuration" }), Object.keys(value.configuration).length ? _jsx("dl", { className: "flow-plugin-facts", "aria-label": "Public configuration", children: Object.entries(value.configuration).map(([key, setting]) => _jsxs("div", { children: [_jsx("dt", { children: key }), _jsx("dd", { children: String(setting) })] }, key)) }) : _jsx("p", { children: "No public values configured." }), _jsx("p", { className: "flow-plugin-note", children: "These grants describe center registry categories. Browser extension permissions and activation are managed separately." })] });
}
function Version({ value }) {
    return _jsxs("li", { children: [_jsx("strong", { children: value.packageVersion }), _jsxs("dl", { className: "flow-plugin-facts", children: [_jsx("dt", { children: "License" }), _jsx("dd", { children: value.license }), _jsx("dt", { children: "Declared categories" }), _jsx("dd", { children: value.capabilities.join(', ') || 'None' }), _jsx("dt", { children: "Declared SHA-256" }), _jsx("dd", { className: "flow-plugin-digest", children: value.declaredSha256 }), _jsx("dt", { children: "Declared on" }), _jsx("dd", { children: _jsx("time", { dateTime: value.createdAt, children: new Date(value.createdAt).toLocaleString() }) })] })] });
}
function Versions({ registry, id }) {
    const [after, onPage] = useState();
    return _jsx(VersionPage, { registry: registry, id: id, after: after, onPage: onPage }, after ?? 'first');
}
function VersionPage({ registry, id, after, onPage }) {
    const load = useCallback((signal) => registry.pluginVersions(id, { after, limit: PAGE_SIZE }, signal), [registry, id, after]);
    const read = useRead(load);
    if (!read.data)
        return _jsx(ReadNotice, { ...read, label: "versions" });
    return _jsxs(_Fragment, { children: [_jsx("h4", { children: "Declared versions" }), read.data.versions.length ? _jsx("ul", { className: "flow-plugin-history", children: read.data.versions.map(value => _jsx(Version, { value: value }, value.id)) }) : _jsx("p", { children: "No versions recorded." }), _jsx(Paging, { label: "versions", after: after, next: read.data.nextCursor, onPage: onPage })] });
}
function Operations({ registry, id }) {
    const [after, onPage] = useState();
    return _jsx(OperationPage, { registry: registry, id: id, after: after, onPage: onPage }, after ?? 'first');
}
function OperationPage({ registry, id, after, onPage }) {
    const load = useCallback((signal) => registry.pluginOperations(id, { after, limit: PAGE_SIZE }, signal), [registry, id, after]);
    const read = useRead(load);
    if (!read.data)
        return _jsx(ReadNotice, { ...read, label: "audit history" });
    const titles = { register: 'Registration', configure: 'Configuration changed', 'set-grants': 'Grants changed', 'register-version': 'Version declared', 'select-version': 'Version selected' };
    return _jsxs(_Fragment, { children: [_jsx("h4", { children: "Revision audit" }), read.data.operations.length ? _jsx("ol", { className: "flow-plugin-history", children: read.data.operations.map(item => _jsxs("li", { children: [_jsx("strong", { children: titles[item.kind] }), _jsxs("p", { children: ["Revision ", item.beforeRevision ?? '—', " \u2192 ", item.afterRevision, " \u00B7 ", item.actor, " \u00B7 ", item.status] }), _jsx("time", { dateTime: item.createdAt, children: new Date(item.createdAt).toLocaleString() })] }, item.id)) }) : _jsx("p", { children: "No operations recorded." }), _jsx(Paging, { label: "audit", after: after, next: read.data.nextCursor, onPage: onPage })] });
}
function LocalPlugins({ runtime }) {
    const items = useSyncExternalStore(runtime.subscribe, runtime.list, runtime.list);
    return _jsxs("section", { className: "flow-plugin-local", "aria-label": "Browser extensions", children: [_jsxs("header", { children: [_jsx("h2", { children: "This browser connection" }), _jsx("p", { children: "Trusted local extensions" })] }), _jsx("p", { className: "flow-plugin-note", children: "Live state from this connection's host. Center registration does not load or activate these extensions." }), items.length ? _jsx("ul", { className: "flow-plugin-rows", children: items.map(item => _jsxs("li", { children: [_jsxs("div", { className: "flow-plugin-row", children: [_jsxs("span", { children: [_jsx("strong", { children: item.id }), _jsxs("small", { children: ["Version ", item.version] })] }), _jsx("span", { className: "flow-plugin-status", children: item.state })] }), item.error ? _jsx("p", { className: "flow-plugin-error", children: item.error }) : null] }, item.id)) }) : _jsx("p", { children: "No local extensions registered in this connection." })] });
}
