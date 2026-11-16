import { CloudDatabaseProvider } from './types';
import { SupabaseDatabaseProvider } from './supabaseProvider';

/**
 * Active cloud database provider instance.
 * To migrate away from Supabase in the future, implement `CloudDatabaseProvider`
 * for your new backend (e.g. `CustomPostgresProvider`) and swap it here.
 */
export const cloudDatabase: CloudDatabaseProvider = new SupabaseDatabaseProvider();

export * from './types';
