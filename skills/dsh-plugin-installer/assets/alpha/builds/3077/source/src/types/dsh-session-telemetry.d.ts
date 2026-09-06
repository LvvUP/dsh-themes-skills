/**
 * Ambient type shim for @deepseek-ai/dsh-session-telemetry.
 *
 * The @deepseek-ai/* packages are NOT published on the public npm registry;
 * the harness resolves them at load time. Standalone typecheck relies on this
 * loose surface; the real package ships the strict interface.
 */

declare module '@deepseek-ai/dsh-session-telemetry' {
  /** One telemetry record handed to the redaction waterfall (loose). */
  export interface TelemetryRecord {
    channel: 'ledger' | 'ops'
    time: number
    severity: string
    attributes: Record<string, string | number>
    body: unknown
  }
}
