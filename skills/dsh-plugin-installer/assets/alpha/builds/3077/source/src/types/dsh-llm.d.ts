/**
 * Ambient type shim for @deepseek-ai/dsh-llm.
 *
 * The @deepseek-ai/* packages are NOT published on the public npm registry;
 * the harness resolves them at load time. Standalone typecheck relies on this
 * loose surface; the real package ships the strict interface.
 */

declare module '@deepseek-ai/dsh-llm' {
  /** One content block of a message (loose). */
  export interface ContentBlock {
    type: string
    text?: string
    [key: string]: unknown
  }

  /** Message provenance (loose). */
  export interface MessageSource {
    kind: 'plugin' | 'user' | string
    plugin?: string
    form?: string
    summary?: string
    [key: string]: unknown
  }

  /** An injected user-facing message (loose). */
  export interface UserMessage {
    content: ContentBlock[]
    source: MessageSource
  }

  /** Create a user message (runtime value — only resolves inside the harness). */
  export function createUserMessage(input: {
    content: ContentBlock[]
    source: MessageSource
  }): UserMessage
}
