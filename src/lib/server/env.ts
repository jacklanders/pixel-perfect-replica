// Lectura de variables de entorno compatible con Node/Vite/Workers.
export function getEnvVar(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env && name in process.env) {
    const val = process.env[name];
    if (val) return val;
  }
  try {
    const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (viteEnv && name in viteEnv) {
      const val = viteEnv[name];
      if (val) return val;
    }
  } catch {
    // import.meta.env no disponible
  }
  return undefined;
}

export function isProduction(): boolean {
  return getEnvVar("NODE_ENV") === "production";
}

/**
 * El modo MOCK_AUTH=true es un bypass total del login usado SOLO en tests E2E
 * (playwright.config.ts). Requiere DOS condiciones para activarse:
 *   1. MOCK_AUTH === "true"
 *   2. NODE_ENV !== "production"
 * Nunca debe activarse en producción, aunque alguien setee MOCK_AUTH por error.
 */
export function isMockAuthEnabled(): boolean {
  if (isProduction()) return false;
  return getEnvVar("MOCK_AUTH") === "true";
}
