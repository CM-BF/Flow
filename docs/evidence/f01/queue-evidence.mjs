// Playwright failure call logs can include fill values, including password inputs.
export function redactText(text, secrets) {
  let result = String(text);
  for (const secret of secrets.filter(value => typeof value === 'string' && value.length).sort((a, b) => b.length - a.length)) {
    for (const form of new Set([JSON.stringify(secret).slice(1, -1), secret])) result = result.replaceAll(form, '[REDACTED]');
  }
  return result;
}
export function evidenceJson(value, secrets) { return redactText(JSON.stringify(value, null, 2), secrets) + '\n'; }
