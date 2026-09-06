# Third-party notices

## DeepSeek V3 tokenizer

The files under `assets/deepseek-v3/` were extracted without modification from DeepSeek's official tokenizer archive:

- Source: <https://cdn.deepseek.com/api-docs/deepseek_v3_tokenizer.zip>
- Archive SHA-256: `c954ca6f6e54281d72d3c27e2430cea7663f81292b39982e2f97890c66c302de`
- `tokenizer.json` SHA-256: `ecb6f9fc369894346f0511f4074ca75cee5cd5f3b06d02f1ba35fcd39f8e121d`
- `tokenizer_config.json` SHA-256: `144a6d92b6012baeb4f2ac41d48ed3458e758f977a0fb5caf75ff07698fc844c`

DeepSeek publishes its tokenizer with the DeepSeek-V3 model materials. Review the upstream code and model license terms before redistributing a release:

- <https://github.com/deepseek-ai/DeepSeek-V3>
- <https://github.com/deepseek-ai/DeepSeek-V3/blob/main/LICENSE-CODE>
- <https://github.com/deepseek-ai/DeepSeek-V3/blob/main/LICENSE-MODEL>

## Hugging Face Tokenizers

`@huggingface/tokenizers` is used to execute the bundled tokenizer in Node.js. It is distributed under the Apache License 2.0:

- <https://www.npmjs.com/package/@huggingface/tokenizers>
- <https://github.com/huggingface/tokenizers.js>

## Fixed adaptation dependencies and licenses

The Alpha adaptation bundles @huggingface/tokenizers 0.1.3 (Apache-2.0), zod 4.4.3 (MIT), schemastery 3.18.0 (MIT), and its cosmokit 1.8.1 dependency (MIT). Exact tarball identities and all file hashes are recorded in DEPENDENCIES.json. @standard-schema/spec 1.1.0 is preserved in the reproduction inputs; its runtime use is eliminated where type-only. License texts are included under licenses/.

DeepSeek LICENSE-CODE and LICENSE-MODEL are copied from deepseek-ai/DeepSeek-V3@9b4e9788e4a3a731f7567338ed15d3ec549ce03b. The tokenizer JSON remains exactly the bytes recorded above; no model weights are included. The primary plugin source is BSD-3-Clause; bundled dependency and tokenizer notices remain separately applicable.

schemastery LICENSE is from shigma/schemastery@9e1f54f8ff785a4e51a022922999634205b61e1f, the registry-recorded gitHead for 3.18.0.
