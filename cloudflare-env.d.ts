declare namespace Cloudflare {
  interface Env {
    HYPERDRIVE?: Hyperdrive;
    DATABASE_URL?: string;
    DATABASE_PROVIDER?: string;
    SUPABASE_URL?: string;
    SUPABASE_SECRET_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
