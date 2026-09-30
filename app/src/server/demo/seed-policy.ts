export function isDemoAutoSeedEnabled() {
  const configured = process.env.DEMO_AUTO_SEED;

  if (configured !== undefined) {
    return configured === "true";
  }

  return process.env.NODE_ENV !== "production";
}
