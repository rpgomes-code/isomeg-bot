import { config } from './constants/config';
import { runMigrations } from './db/migrate';
import { assertEnv } from './lib/env';
import { Client } from './core/client';

async function main(): Promise<void> {
    assertEnv(config.botConfig.requiredEnv);

    await runMigrations();

    const client: Client = new Client();
    await client.login(config.botConfig.clientToken);
}

main().catch((error) => {
    console.error("[Startup] Failed to start bot:", error);
    process.exit(1);
});
