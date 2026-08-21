export function assertBundledCssSafe(css, label = 'Bundled CSS') {
  if (typeof css !== 'string') {
    throw new TypeError(`${label} must be text`);
  }
  if (/\\/.test(css)) {
    throw new Error(`${label} contains a forbidden CSS escape`);
  }
  const tokens = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/@import\b|javascript\s*:/i.test(tokens)) {
    throw new Error(`${label} contains a forbidden remote or executable reference`);
  }
  // These two reviewed adaptations contain no runtime assets. Reject every
  // url() token, including protocol-relative, data, remote, and relative
  // spellings, so no unbound file or network reference can be introduced.
  if (/url\s*\(/i.test(tokens)) {
    throw new Error(`${label} contains a forbidden unbound url() reference`);
  }
}
