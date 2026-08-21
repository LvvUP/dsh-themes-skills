/**
 * Exact complete-tarball authority generated from the promoted hosted index.
 *
 * A catalog record can discover a slug, but it cannot add or replace an entry
 * here. Every value is the SHA-256 of the complete published `.tgz`.
 */
export const CURRENT_CATALOG_INDEX_SHA256 =
  '0dd86b35ed13557d8dfa80b20a2290b17476fb03dc096b6f56bf4667c2377645';

export const CURRENT_INSTALLABLE_HOSTED_ARTIFACTS = new Map([
  ['@dsh-themes/abyssal-maid@1.1.0', '7d25f7b1052f0d7988c9e145aea65c3a542e33dc78d64254ae38f6dd87b174d4'],
  ['@dsh-themes/arcana-nocturne@1.0.0', 'd4354bed87b2a50f405f927212060dc6db1089fe964b90d3fdd7065d7af7247a'],
  ['@dsh-themes/arctic-panel@1.2.0', 'd3842b98fc58d6db577482a7093953b6c32e48a4e3441b95aa7bad5ddd55263a'],
  ['@dsh-themes/argentina-matchday@1.0.0', '7020c1461f8f2f453f168cd98f9284e567765b322c8119a08cd0a05ad895b41e'],
  ['@dsh-themes/banff-alpine@1.0.0', '4421e056411e2343fd9709398b746e45fb7f2b7419a59fd17b7b8414674d137c'],
  ['@dsh-themes/copper-wire@1.1.0', 'bdc6dee20634f9bef9769f9cbd029b1c9eb6d416008eaac8d7bf35eca6d12da4'],
  ['@dsh-themes/deep-ocean@1.2.0', '8fca6598f084b47ec07bd00876a686c640ad68f280b5737b789a68fa5df5044f'],
  ['@dsh-themes/eiffel-lumiere@1.0.0', 'f7de792d3455deb9af3ad82ed2b216019c6f290ffc8bc9c8ecb7cc755fea27ed'],
  ['@dsh-themes/england-matchday@1.0.0', 'd8458842356a47e21dab78cfe408686caf115a7a1cb0c0ba57ce354f6de94b05'],
  ['@dsh-themes/frontier-ink@1.0.0', '4b0af8c22e95ad32b49bb612edd9ea243bd35ed1eef0c889dbe5c7b3766256a9'],
  ['@dsh-themes/germany-matchday@1.0.0', 'f844d4573e93eddbb16d9c8ff4a392e81adfb5700a90617ddb4737234dd78221'],
  ['@dsh-themes/graphite-relay@1.2.0', '6f23cd12796a6373bbe8612ecc2a86b7a7d8e563beb24ecb57ddfd10e86c358c'],
  ['@dsh-themes/harbour-pulse@1.0.0', '3237b72d766131c2a227619f85442febbb09e91e49e057f46033c84855780996'],
  ['@dsh-themes/high-signal@1.2.0', '01acb404b6273289fa31848c08388d0b99d199b1d8acdad1f958d734d2df14c3'],
  ['@dsh-themes/jade-circuit@1.2.0', '639b3aefc09e204904a5541c82f81310f9c54ca9818473bde8afcaaa958a9fbb'],
  ['@dsh-themes/jianghu-ink@1.0.0', 'ee71a932f7239eeff7783d04e432c1d77a37759a648c6f5f0f216aafd71cc57b'],
  ['@dsh-themes/liberty-ink@1.0.0', '679334992ac33c7c42fdc46a9836309af23daa9c26eaf3a5b2e727f9946ae65d'],
  ['@dsh-themes/neon-afterline@1.2.0', 'e3f9c368317dd1603c98659cccc262fd62e0ba68731641769e3717e4330353f7'],
  ['@dsh-themes/paper-console@1.2.0', 'f140a38123331ebbebbd63ee0e5af17ce88268ebcba340e55be4e3db12ff0891'],
  ['@dsh-themes/quiet-matrix@1.2.0', '0432133c40caa1a320146c1c897e7ef905e77312fc8cc5ee83249ad2e88bfa1e'],
  ['@dsh-themes/reasoning-tide@1.1.0', '1f05fc67471b8b004397b3582b2ed1e56a45b3ac79f27688e337699e3d46d3a6'],
  ['@dsh-themes/redline-02@1.1.0', 'b3716d237822f58613b884dad9d82a1f4cb2ca9f873f28d0705b5c73f1aaecd9'],
  ['@dsh-themes/sakura-kawaii@1.0.0', 'db23f03ff3b7f430cfeed0845335385cfa5751dc6159438c614c8a75a3c546fa'],
  ['@dsh-themes/savanna-horizon@1.0.0', '871df50c52525e8aaa31e11a344394861774fe4c82b0c99978752bffcce405b7'],
  ['@dsh-themes/solar-trace@1.2.0', 'af447d963e9f5a6cae8454dff553665b16500dfd52a724ab9e75f47f007f56e7'],
  ['@dsh-themes/spain-matchday@1.0.0', '133d86d0ff213d43e45649e1b419175c1c432b26510433e78d8835dd2e49cfa8'],
  ['@dsh-themes/st-basils-avant@1.0.0', '3389af4624f0b7e4dff23c07bc1a3063a39120073a6e7df495c34523cdbc8a95'],
  ['@dsh-themes/suomenlinna-nordic@1.0.0', '302c711211570aea00a9395dc22d889bf9ca5395f2f2601b3bffb72ce6d1a013'],
  ['@dsh-themes/swanstone-modern@1.0.0', '2c6c70615a5146d12e82ea3c774f99be2d0d4a4a6859056a7bf14ac9c26752a2'],
  ['@dsh-themes/yellowstone-wpa@1.0.0', '81df3360ddb514195b9ce76fbf36557208e0be283eea243844afc0ffc62e84ab'],
]);

/**
 * Retired V1/V2/V3 packages retained only to restore a schema-2 rollback record.
 * These entries are never valid fresh-install targets or normal catalog
 * authority.
 */
export const LEGACY_ROLLBACK_HOSTED_ARTIFACTS = new Map([
  ['@dsh-themes/abyssal-maid@1.0.0', 'a771302807b57ba615817f3c029eeeca47866396d2d48c9fcb98984186503642'],
  ['@dsh-themes/arctic-panel@1.0.0', 'dba7f725d96ea15a3f93d209df849ce138ad7ef3a1309d21a5e8c796430c3e67'],
  ['@dsh-themes/arctic-panel@1.1.0', 'f5e90f8b335b3cc0e484040515621b12622d103252e148492b6effab73dc4b28'],
  ['@dsh-themes/copper-wire@1.0.0', '4f6e98758719dc2c6cd58a8c6e88b308e131d76be524f8e83ce43c9dea6e09cc'],
  ['@dsh-themes/deep-ocean@1.0.0', '3b045ef5e7022d45fcfda7bac44671e2dfdcba3c1e2b050ee27b6f5f00171318'],
  ['@dsh-themes/deep-ocean@1.1.0', '342a1f9cb1db44b1e2163239bf25f96c7661f948a39d36d7ca479c8ece96ec35'],
  ['@dsh-themes/graphite-relay@1.0.0', 'c8d4923d72b11d6d8c497f286b2cdfae8647282bdb8bea2e7d76374e4d65709f'],
  ['@dsh-themes/graphite-relay@1.1.0', '00d457a01c485d9a560553c05c5167b4ebacbd48bd0ebbf95897b010b71bdb22'],
  ['@dsh-themes/high-signal@1.0.0', '06b970b458b229ff54ea0305f3a1f20bbab41a1233d553aef0f4762cb96d1899'],
  ['@dsh-themes/high-signal@1.1.0', '3050387b2a93426d13c3cd05aeb540d4b89dac394d40bc2d09e1f8f9706adae7'],
  ['@dsh-themes/jade-circuit@1.0.0', '0a4216e6a0c4f971b292422b3787a82e33103e9213b1060ccf42a532cb360fd6'],
  ['@dsh-themes/jade-circuit@1.1.0', '7aedc09eb66ee5bf57ce7d615da8b47f34c130277cc34cdae4d631f390015d98'],
  ['@dsh-themes/neon-afterline@1.0.0', '7fe618b780ab03cdce407e69d3d90ef20d179bf3e2902a445bd845e14dcbeb95'],
  ['@dsh-themes/neon-afterline@1.1.0', '9417f66297422f3a0d3311d3b07587da75d5d16aab2d149b32342a36510ce7b9'],
  ['@dsh-themes/paper-console@1.0.0', 'fe25a1680f543afd2663a8cba78caf98c1eeb5a90da101d1fede0422f5e3cf51'],
  ['@dsh-themes/paper-console@1.1.0', 'f9bbd9ca049e4d5efb2909e1250c9231a042cad7bfbbe340a215573ea9debaa7'],
  ['@dsh-themes/quiet-matrix@1.0.0', '1ca26b696956f07a3b0a8278cd6b0ef32b5e7c17e91982c7d97542b47213a3ef'],
  ['@dsh-themes/quiet-matrix@1.1.0', 'c3067862b989fbb4d79a23a5569e4ff735f5df358a56b67a71af11a9501b6627'],
  ['@dsh-themes/reasoning-tide@1.0.0', '8168017e15d40d626f04de3866472baab14f70c5e813d743e27a4eac0c5015d1'],
  ['@dsh-themes/redline-02@1.0.0', 'fca9d050bd6c6c406f4a700759a029a0102ddc741db4aac63d63b78d52468420'],
  ['@dsh-themes/solar-trace@1.0.0', '5e0e2b319d137b784ebd25df795f0ac004647591a11ba7e7ea7a81d90af1270a'],
  ['@dsh-themes/solar-trace@1.1.0', 'eb645cef469502af39626144e238656b2a79805c7409267c11f9e01a5fa31c39'],
]);

export const SKIN_CENTER_ARTIFACT_SHA256 =
  '5b0c06426320a011a54cc8ddbe921e7b3f2d8d11a3d18bf0b92ad186ffb39499';

export const CURRENT_INSTALLABLE_ADD_ARTIFACT_SHA256 = new Set([
  ...CURRENT_INSTALLABLE_HOSTED_ARTIFACTS.values(),
  SKIN_CENTER_ARTIFACT_SHA256,
]);

export const LEGACY_ROLLBACK_ADD_ARTIFACT_SHA256 = new Set(
  LEGACY_ROLLBACK_HOSTED_ARTIFACTS.values()
);

/** The runner may see these bytes, but legacy digests need record authority. */
export const ALLOWED_ADD_ARTIFACT_SHA256 = new Set([
  ...CURRENT_INSTALLABLE_ADD_ARTIFACT_SHA256,
  ...LEGACY_ROLLBACK_ADD_ARTIFACT_SHA256,
]);

export function classifyHostedArtifact(
  packageName,
  version,
  artifactSha256,
  {
    currentArtifacts = CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
    legacyArtifacts = LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
  } = {}
) {
  const key = `${packageName}@${version}`;
  if (currentArtifacts.get(key) === artifactSha256) return 'current-installable';
  if (legacyArtifacts.get(key) === artifactSha256) return 'legacy-rollback';
  return null;
}
