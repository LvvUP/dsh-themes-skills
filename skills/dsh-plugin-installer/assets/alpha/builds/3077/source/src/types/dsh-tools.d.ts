/**
 * Ambient type shim for @deepseek-ai/dsh-tools.
 *
 * The @deepseek-ai/* packages are NOT published on the public npm registry;
 * the harness resolves them at load time. This file exists so `npm run
 * typecheck` works standalone. It covers the subset this plugin uses and is
 * deliberately loose — when the harness ships real types, delete this file
 * and add the package as a dev dependency.
 */

declare module '@deepseek-ai/dsh-tools' {
  export interface ToolParameterSpec {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | (string & {})
    required?: boolean
    description?: string
    [key: string]: unknown
  }
  type ParamType<S extends ToolParameterSpec> = S['type'] extends 'string'
    ? string
    : S['type'] extends 'number'
      ? number
      : S['type'] extends 'boolean'
        ? boolean
        : S['type'] extends 'null'
          ? null
          : unknown

  /** Infer the execute() args record from a parameters schema, mirroring the real package. */
  export type InferArgs<Params extends Record<string, ToolParameterSpec>> = {
    [K in keyof Params as Params[K] extends { required: true } ? K : never]: ParamType<Params[K]>
  } & {
    [K in keyof Params as Params[K] extends { required: true } ? never : K]?: ParamType<Params[K]>
  }

  export interface ToolOutputDefinition<TArgs, TValue> {
    schema?: unknown
    render?: (args: TArgs, value: TValue) => Array<{ type: string; text: string }>
  }

  /** A pending tool call inside the registry pipeline (loose standalone shape). */
  export interface ToolExecution {
    readonly callId: string
    readonly name: string
    readonly arguments: unknown
    readonly agent?: import('@deepseek-ai/dsh-agent').Agent
    readonly signal: AbortSignal
  }

  /** The runtime context handed to a tool after the registry accepted the call. */
  export interface ToolRunContext extends ToolExecution {
    concludeTurn(): void
    deferContext(message: unknown): void
  }

  /** Post-execute decision; `additionalContexts` rides injected model context. */
  export type PostToolDecision = {
    kind: 'accept' | 'block' | string
    feedback?: string
    additionalContexts?: unknown[]
  }

  export interface ToolDefinition<TArgs = Record<string, unknown>, TValue = unknown> {
    name: string
    description: string
    parameters: Record<string, ToolParameterSpec>
    output?: ToolOutputDefinition<TArgs, TValue>
    /** Register the tool but keep it out of the model-facing schema projection (still callable). */
    hidden?: boolean
    presentCall?: (args: TArgs) => unknown
    execute: (
      args: TArgs,
      exec: ToolRunContext,
    ) => Promise<TValue> | TValue
  }

  export function defineTool<
    Params extends Record<string, ToolParameterSpec>,
    TArgs = InferArgs<Params>,
    TValue = unknown,
  >(
    definition: ToolDefinition<TArgs, TValue> & { parameters: Params },
  ): ToolDefinition<TArgs, TValue>
}

/**
 * The harness's dsh-tools package registers a `tools` service on the Cordis
 * context (that is what `inject = ['tools']` waits for). The public cordis
 * package's types do not know about it; declare the narrow surface here,
 * together with the harness-side service accessors the plugin uses.
 */
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Tool registry service — provided by @deepseek-ai/dsh-tools in the harness. */
    tools: {
      register(tool: unknown): () => void
      guard(guard: (exec: import('@deepseek-ai/dsh-tools').ToolExecution) => string | undefined): () => void
    }
    /** @deepseek-ai/dsh-agent registry (ambient). */
    agents: {
      roots(): Array<import('@deepseek-ai/dsh-agent').Agent>
      list(): Array<import('@deepseek-ai/dsh-agent').Agent>
      get(id: string): unknown
    }
    /** @deepseek-ai/dsh-invariants service (ambient). */
    invariants: {
      register(packageName: string, installer: unknown): () => void
    }
    /** Optional service read (harness Context). */
    get<T>(name: string): T | undefined
    /** Register an event listener; returns the disposer. */
    on(event: string, listener: (...args: any[]) => unknown, options?: { global?: boolean }): () => void
    /** Register an effect with an optional teardown; returns the disposer. */
    effect(setup: () => (() => void) | void, label?: string): () => void
  }
}
