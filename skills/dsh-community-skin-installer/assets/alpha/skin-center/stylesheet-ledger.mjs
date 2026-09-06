/** Bind the new link, retaining the prior activation until its own teardown. */
export function bindLoadedStylesheet(doc, ledger, activation, label, href) {
  const links = [...doc.head.querySelectorAll(`link[href="${href}"]`)];
  const loaded = links.at(-1);
  if (!loaded) throw new Error(`Loaded skin stylesheet is missing: ${href}`);
  // tapIndex's first-paint link has no activation owner. Remove it only after
  // its replacement has loaded, so cold adoption cannot flash the stock skin.
  for (const link of links) {
    if (link !== loaded && link.hasAttribute('data-dsh-skin-link'))
      link.remove();
  }
  ledger.record(activation, `style:${label}`, () => loaded.remove());
}
