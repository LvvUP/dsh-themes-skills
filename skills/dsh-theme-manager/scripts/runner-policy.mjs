export {
  ALLOWED_ADD_ARTIFACT_SHA256,
  CURRENT_INSTALLABLE_ADD_ARTIFACT_SHA256,
  LEGACY_ROLLBACK_ADD_ARTIFACT_SHA256,
} from './hosted-artifact-authority.mjs';

const HOSTED_THEME = /^@dsh-themes\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/** The only executable community package the adjacent installer may remove. */
export const COMMUNITY_REMOVE_PACKAGE =
  '@linxin666/dsh-client-ui-skin-center';

export function isAllowedRunnerCommand(values) {
  if (values.length === 1 && ['--version', '-V'].includes(values[0])) {
    return true;
  }
  if (
    values.length === 3 &&
    values[0] === '--profile' &&
    values[1] === 'web' &&
    ['--dump-config', '--dump-default-config'].includes(values[2])
  ) {
    return true;
  }
  if (
    values[0] === 'plugin' &&
    values[1] === '--profile' &&
    values[2] === 'web'
  ) {
    const action = values[3];
    if (action === 'list') return values.length === 5 && values[4] === '--json';
    if (action === 'remove') {
      return (
        values.length === 5 &&
        (HOSTED_THEME.test(values[4]) ||
          values[4] === COMMUNITY_REMOVE_PACKAGE)
      );
    }
    if (action === 'add') {
      return (
        values.length === 6 &&
        typeof values[4] === 'string' &&
        values[4].endsWith('.tgz') &&
        values[5] === '--save-exact'
      );
    }
    return false;
  }
  if (values[0] === 'web') {
    const options = values.slice(1);
    if (options.length === 0) return true;
    return (
      options.length === 2 &&
      options[0] === '--port' &&
      /^(?:0|[1-9]\d{0,4})$/.test(options[1]) &&
      Number(options[1]) <= 65535
    );
  }
  return false;
}

export function buildDshChildArgs(values, resolvePath) {
  if (!isAllowedRunnerCommand(values)) {
    throw new TypeError('unsupported runner command');
  }
  if (
    values[0] === 'plugin' &&
    values[3] === 'add' &&
    resolvePath(values[4]) !== values[4]
  ) {
    throw new TypeError('plugin artifact must use an absolute path');
  }
  if (values[0] !== 'web') return [...values];

  // RC.8 defaults to opening a browser. The Manager always supplies exactly
  // one negative flag and rejects all user-supplied open/host flags above.
  return [
    'web',
    '--host',
    '127.0.0.1',
    '--no-open',
    ...values.slice(1),
  ];
}
