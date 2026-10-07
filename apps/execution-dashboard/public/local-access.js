const byId = id => document.getElementById(id);
const dialog = byId('local-access-dialog');
const trigger = byId('local-access-open');
const tokenInput = byId('local-access-token');
const loadButton = byId('local-access-load');
const revealButton = byId('local-access-reveal');
const copyButton = byId('local-access-copy');
const clearButton = byId('local-access-clear');
const status = byId('local-access-status');
const availability = byId('local-access-availability');
const retryMetadata = byId('local-access-retry');
let enabled = false;
let ownerToken = '';
let generation = 0;
let pending;
let requestTimer;
let invoker;

function clearToken(message = '凭据已清除；需要时请重新加载。') {
  generation += 1;
  pending?.abort();
  pending = undefined;
  clearTimeout(requestTimer);
  ownerToken = '';
  tokenInput.value = '';
  tokenInput.type = 'password';
  tokenInput.disabled = true;
  revealButton.disabled = copyButton.disabled = clearButton.disabled = true;
  revealButton.textContent = '显示';
  revealButton.setAttribute('aria-pressed', 'false');
  loadButton.disabled = !enabled;
  loadButton.textContent = '加载 owner token';
  status.textContent = message;
}

async function readMetadata() {
  retryMetadata.disabled = true;
  try {
    const response = await fetch('/api/local-access', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('metadata unavailable');
    const data = await response.json();
    const product = new URL(data.productUrl);
    if (typeof data.enabled !== 'boolean' || product.protocol !== 'http:' || product.hostname !== '127.0.0.1'
      || product.username || product.password || product.search || product.hash || product.pathname !== '/' || data.centerUrl !== '') throw new Error('invalid metadata');
    enabled = data.enabled;
    for (const link of document.querySelectorAll('[data-local-product]')) link.href = product.href;
    byId('local-access-product-url').textContent = product.href;
    availability.textContent = enabled ? '本机安装已启用按需读取。凭据尚未加载。' : '本机凭据读取未启用。远程或企业部署默认禁用，请联系安装负责人。';
    retryMetadata.hidden = true;
  } catch {
    enabled = false;
    availability.textContent = '连接资料暂不可读取。请使用本机 127.0.0.1 看板地址，或稍后重试。';
    retryMetadata.hidden = false;
  } finally {
    retryMetadata.disabled = false;
    loadButton.disabled = !enabled || Boolean(pending);
  }
}

trigger.addEventListener('click', () => {
  invoker = document.activeElement;
  clearToken('凭据尚未加载。仅在需要连接时主动加载。');
  dialog.showModal();
});
byId('local-access-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  clearToken();
  if (document.visibilityState === 'visible' && invoker?.isConnected && invoker.getClientRects().length) invoker.focus();
  invoker = undefined;
});
dialog.addEventListener('cancel', () => clearToken());
retryMetadata.addEventListener('click', readMetadata);
clearButton.addEventListener('click', () => clearToken());

loadButton.addEventListener('click', async () => {
  if (!enabled || !dialog.open || document.visibilityState !== 'visible') return;
  clearToken('正在加载本机凭据…');
  const current = generation;
  const controller = new AbortController();
  pending = controller;
  loadButton.disabled = true;
  loadButton.textContent = '正在加载…';
  requestTimer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/local-access/owner-token', {
      method: 'POST', cache: 'no-store', credentials: 'omit', signal: controller.signal,
      headers: { 'X-Flow-Local-Access': '1' },
    });
    if (!response.ok) throw new Error('credential unavailable');
    const data = await response.json();
    if (typeof data.ownerToken !== 'string' || !/^[A-Za-z0-9_-]{32,512}$/.test(data.ownerToken)) throw new Error('invalid credential');
    if (current !== generation || !dialog.open || document.visibilityState !== 'visible') return;
    ownerToken = data.ownerToken;
    tokenInput.value = ownerToken;
    tokenInput.disabled = false;
    revealButton.disabled = copyButton.disabled = clearButton.disabled = false;
    status.textContent = '凭据已加载并掩码。显示或复制后，粘贴到 Flow 的 Token 输入框。';
  } catch {
    if (current === generation) clearToken('加载失败。请重试；若仍失败，请由安装负责人核对本机配置与权限。');
  } finally {
    if (current === generation) {
      pending = undefined;
      clearTimeout(requestTimer);
      loadButton.disabled = !enabled;
      loadButton.textContent = '重新加载 owner token';
    }
  }
});

revealButton.addEventListener('click', () => {
  if (!ownerToken || !dialog.open) return;
  if (tokenInput.type === 'text') { clearToken(); return; }
  tokenInput.type = 'text';
  revealButton.textContent = '隐藏并清除';
  revealButton.setAttribute('aria-pressed', 'true');
  status.textContent = '凭据已显示。离开页面或关闭此窗口会清除页面中的凭据。';
});
copyButton.addEventListener('click', async () => {
  if (!ownerToken || !dialog.open || document.visibilityState !== 'visible') return;
  const current = generation;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(ownerToken);
    if (current === generation) status.textContent = '已复制。请在 Flow 中粘贴；页面清除不会清除系统剪贴板。';
  } catch {
    if (current === generation) status.textContent = '无法复制：浏览器未允许剪贴板操作。可点击“显示”后手动复制。';
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') clearToken(); });
window.addEventListener('pagehide', () => { clearToken(); if (dialog.open) dialog.close(); });
readMetadata();
