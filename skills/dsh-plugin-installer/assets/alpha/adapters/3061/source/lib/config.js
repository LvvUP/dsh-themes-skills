import z from "@deepseek-ai/schemastery";
import { ComputerUseError } from "./errors.js";
const COMPUTER_USE_SETTINGS_NAMESPACE = "computer-use";
const Config = z.object({
  observationTtlMs: z.number().default(0),
  confirmationTtlMs: z.number().default(3e5),
  actionTimeoutMs: z.number().default(15e3),
  settleMs: z.number().default(250),
  maxSettleMs: z.number().default(5e3),
  maxNodes: z.number().default(500),
  maxDepth: z.number().default(14),
  maxTextBytes: z.number().default(64e3),
  maxScreenshotBytes: z.number().default(33554432),
  artifactRoot: z.string().default(".dsh-computer-use/artifacts"),
  helper: z.object({
    path: z.string(),
    allowSourceBuild: z.boolean().default(false)
  }),
  interaction: z.object({
    focusPolicy: z.union(["preserve", "activate"]).default("preserve"),
    keyboardPolicy: z.union(["preserve", "activate"]).default("preserve"),
    pointerInputPolicy: z.union(["deny", "targeted"]).default("targeted"),
    cursorVisualization: z.union(["hidden", "visible"]).default("visible"),
    cursorMotionMs: z.number(),
    cursorSpeedPxPerSecond: z.number().default(1600),
    cursorAccelerationPxPerSecondSquared: z.number().default(6e3),
    cursorClickDelayMs: z.number().default(90),
    cursorAutoHideMs: z.number().default(0)
  }),
  allowAllApps: z.boolean().default(false),
  grants: z.array(z.object({
    bundleId: z.string(),
    read: z.boolean().default(false),
    control: z.boolean().default(false)
  })).default([])
});
function integer(name, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}
function option(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `${name} must be one of ${allowed.join(", ")}`);
  }
  return value;
}
function resolveConfig(config = {}) {
  const observationTtl = config.observationTtlMs ?? 0;
  const observationTtlMs = observationTtl === 0 ? 0 : integer("observationTtlMs", observationTtl, 1e3, 864e5);
  const confirmationTtlMs = integer("confirmationTtlMs", config.confirmationTtlMs ?? 3e5, 1e3, 9e5);
  const actionTimeoutMs = integer("actionTimeoutMs", config.actionTimeoutMs ?? 15e3, 1e3, 12e4);
  const settleMs = integer("settleMs", config.settleMs ?? 250, 0, 1e4);
  const maxSettleMs = integer("maxSettleMs", config.maxSettleMs ?? 5e3, 100, 6e4);
  if (settleMs > maxSettleMs) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "settleMs must be no greater than maxSettleMs");
  }
  const maxNodes = integer("maxNodes", config.maxNodes ?? 500, 10, 5e3);
  const maxDepth = integer("maxDepth", config.maxDepth ?? 14, 1, 64);
  const maxTextBytes = integer("maxTextBytes", config.maxTextBytes ?? 64e3, 1024, 1048576);
  const maxScreenshotBytes = integer("maxScreenshotBytes", config.maxScreenshotBytes ?? 33554432, 1024, 268435456);
  const artifactRoot = (config.artifactRoot ?? ".dsh-computer-use/artifacts").trim();
  if (artifactRoot.length === 0 || artifactRoot.startsWith("/") || artifactRoot.split(/[\\/]+/u).includes("..")) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "artifactRoot must be a non-empty workspace-relative path without ..");
  }
  const helperPath = config.helper?.path?.trim();
  if (helperPath !== void 0 && helperPath.length === 0) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "helper.path must not be empty");
  }
  const focusPolicy = option("interaction.focusPolicy", config.interaction?.focusPolicy ?? "preserve", ["preserve", "activate"]);
  const keyboardPolicy = option("interaction.keyboardPolicy", config.interaction?.keyboardPolicy ?? "preserve", ["preserve", "activate"]);
  const pointerInputPolicy = option("interaction.pointerInputPolicy", config.interaction?.pointerInputPolicy ?? "targeted", ["deny", "targeted"]);
  const cursorVisualization = option("interaction.cursorVisualization", config.interaction?.cursorVisualization ?? "visible", ["hidden", "visible"]);
  if (config.interaction?.cursorMotionMs !== void 0) {
    integer("interaction.cursorMotionMs", config.interaction.cursorMotionMs, 0, 2e3);
  }
  const cursorSpeedPxPerSecond = integer("interaction.cursorSpeedPxPerSecond", config.interaction?.cursorSpeedPxPerSecond ?? 1600, 100, 5e4);
  const cursorAccelerationPxPerSecondSquared = integer("interaction.cursorAccelerationPxPerSecondSquared", config.interaction?.cursorAccelerationPxPerSecondSquared ?? 6e3, 100, 5e5);
  const cursorClickDelayMs = integer("interaction.cursorClickDelayMs", config.interaction?.cursorClickDelayMs ?? 90, 0, 1e3);
  const cursorAutoHideMs = integer("interaction.cursorAutoHideMs", config.interaction?.cursorAutoHideMs ?? 0, 0, 3e4);
  const allowAllApps = config.allowAllApps ?? false;
  const seen = /* @__PURE__ */ new Set();
  const grants = (config.grants ?? []).map((grant) => {
    const bundleId = grant.bundleId.trim();
    if (bundleId.length === 0 || bundleId === "*" || bundleId.includes("*")) {
      throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "grants[].bundleId must be one exact non-wildcard bundle id");
    }
    if (seen.has(bundleId)) {
      throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `duplicate app grant for ${bundleId}`);
    }
    seen.add(bundleId);
    const control = grant.control ?? false;
    return { bundleId, read: (grant.read ?? false) || control, control };
  });
  return {
    observationTtlMs,
    confirmationTtlMs,
    actionTimeoutMs,
    settleMs,
    maxSettleMs,
    maxNodes,
    maxDepth,
    maxTextBytes,
    maxScreenshotBytes,
    artifactRoot,
    helper: {
      ...helperPath === void 0 ? {} : { path: helperPath },
      allowSourceBuild: config.helper?.allowSourceBuild ?? false
    },
    interaction: {
      focusPolicy,
      keyboardPolicy,
      pointerInputPolicy,
      cursorVisualization,
      cursorSpeedPxPerSecond,
      cursorAccelerationPxPerSecondSquared,
      cursorClickDelayMs,
      cursorAutoHideMs
    },
    allowAllApps,
    grants
  };
}
export {
  COMPUTER_USE_SETTINGS_NAMESPACE,
  Config,
  resolveConfig
};
//# sourceMappingURL=config.js.map
