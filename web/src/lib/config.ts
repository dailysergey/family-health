// Shared runtime configuration read from environment variables.
export const INGEST_SECRET = process.env.HEALTH_INGEST_SECRET || "dev-ingest-secret";
export const TMUX_SESSION = process.env.HEALTH_TMUX_SESSION || "health";
export const HEALTH_PIN = process.env.HEALTH_PIN || "1234";
export const DATA_DIR = process.env.HEALTH_DATA_DIR || "/opt/health/data";
