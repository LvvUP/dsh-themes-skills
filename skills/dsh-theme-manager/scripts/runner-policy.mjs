const HOSTED_THEME = /^@dsh-themes\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/** The only executable community package the adjacent installer may remove. */
export const COMMUNITY_REMOVE_PACKAGE =
  '@linxin666/dsh-client-ui-skin-center';

/** Whole-tarball digests the promoted runner may pass to `plugin add`. */
export const ALLOWED_ADD_ARTIFACT_SHA256 = new Set([
  // Thirteen current hosted V3 artifacts.
  '7d25f7b1052f0d7988c9e145aea65c3a542e33dc78d64254ae38f6dd87b174d4',
  'f5e90f8b335b3cc0e484040515621b12622d103252e148492b6effab73dc4b28',
  'bdc6dee20634f9bef9769f9cbd029b1c9eb6d416008eaac8d7bf35eca6d12da4',
  '8fca6598f084b47ec07bd00876a686c640ad68f280b5737b789a68fa5df5044f',
  '6f23cd12796a6373bbe8612ecc2a86b7a7d8e563beb24ecb57ddfd10e86c358c',
  '01acb404b6273289fa31848c08388d0b99d199b1d8acdad1f958d734d2df14c3',
  '639b3aefc09e204904a5541c82f81310f9c54ca9818473bde8afcaaa958a9fbb',
  '9417f66297422f3a0d3311d3b07587da75d5d16aab2d149b32342a36510ce7b9',
  'f140a38123331ebbebbd63ee0e5af17ce88268ebcba340e55be4e3db12ff0891',
  'c3067862b989fbb4d79a23a5569e4ff735f5df358a56b67a71af11a9501b6627',
  '1f05fc67471b8b004397b3582b2ed1e56a45b3ac79f27688e337699e3d46d3a6',
  'b3716d237822f58613b884dad9d82a1f4cb2ca9f873f28d0705b5c73f1aaecd9',
  'af447d963e9f5a6cae8454dff553665b16500dfd52a724ab9e75f47f007f56e7',
  // Exact @linxin666/dsh-client-ui-skin-center@0.2.5 artifact.
  '5b0c06426320a011a54cc8ddbe921e7b3f2d8d11a3d18bf0b92ad186ffb39499',
]);

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
