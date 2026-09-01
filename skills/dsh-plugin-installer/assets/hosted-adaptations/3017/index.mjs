/**
 * Host discovery anchor for the browser-only Plugin List Plus bundle.
 *
 * DeepSeek Harness scans active Loader rows for `dsh.client` metadata. The
 * Host half therefore exists only to make the package an ordinary Loader row;
 * it requests no service and installs no Host behavior.
 */

export const name = '@dsh-themes/plugin-list-plus'
export const inject = []

export function apply() {}
