import { config } from './constants/config';
import { runMigrations } from './db/migrate';
import { Client } from './core/client';

async function main(): Promise<void> {
    if (!config.botConfig.clientToken) {
        throw new Error("CLIENT_TOKEN is not defined in environment variables");
    }

    await runMigrations();

    const client: Client = new Client();
    await client.login(config.botConfig.clientToken);
}

main().catch((error) => {
    console.error("[Startup] Failed to start bot:", error);
    process.exit(1);
});
