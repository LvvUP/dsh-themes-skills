/**
 * Ambient type shim for @deepseek-ai/dsh-invariants.
 *
 * The @deepseek-ai/* packages are NOT published on the public npm registry;
 * the harness resolves them at load time. Standalone typecheck relies on this
 * loose surface; the real package ships the strict interface.
 */

declare module '@deepseek-ai/dsh-invariants' {
  /** Throw a package-attributed invariant failure. */
  export type InvariantFailure = (message: string) => never

  /** Install one package's checks into the registration's child context. */
  export interface InvariantInstaller {
    (ctx: any, fail: InvariantFailure): void | Promise<void>
    readonly inject?: readonly string[]
  }
}
