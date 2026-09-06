/**
 * Ambient type shim for @deepseek-ai/dsh-agent.
 *
 * The @deepseek-ai/* packages are NOT published on the public npm registry;
 * the harness resolves them at load time. Standalone typecheck relies on this
 * loose surface; the real package ships the strict interface.
 */

declare module '@deepseek-ai/dsh-agent' {
  /** Public live-agent handle (loose standalone shape). */
  export interface Agent {
    /** The single identity shared with the session. */
    readonly id: string
    /** The live session this agent drives (loose). */
    readonly session: {
      readonly id: string
      readonly events: readonly unknown[]
      append(type: string, data: unknown, options?: { surfaceOp?: string }): unknown
      readonly header?: { readonly cwd?: string }
    }
    /** Agent-scoped context; its contributions are agent-local. */
    readonly ctx: unknown
    /** The current lifecycle state. */
    readonly status: 'idle' | 'running' | string
    /** Resolve after the current whole-agent activity reaches quiescence. */
    whenIdle(): Promise<void>
  }
}
