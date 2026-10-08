import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicHomeEnvironment } from './prepare.mjs';

test('fixed real environment policy supplies the fourteen HOME contrast inputs without preparing native', () => {
  const root = '/private/tmp/flow-o16-home-factor-synthetic/native';
  const binding = { username: 'citrine', folders: Object.fromEntries(['home', 'config', 'tmp']
    .map(name => [name, { path: `${root}/${name}` }])) };
  assert.deepEqual(publicHomeEnvironment(binding), {
    HOME: `${root}/home`, CLAUDE_CONFIG_DIR: `${root}/config`,
    TMPDIR: `${root}/tmp`, CLAUDE_TMPDIR: `${root}/tmp`,
    CLAUDE_SECURESTORAGE_CONFIG_DIR: '', USER: 'citrine',
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C.UTF-8',
    DISABLE_AUTOUPDATER: '1', DISABLE_TELEMETRY: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_ENTRYPOINT: 'sdk-ts',
    CLAUDE_AGENT_SDK_VERSION: '0.3.290', CLAUDE_CODE_SDK_READS_SESSION_STATE: '1',
  });
});
