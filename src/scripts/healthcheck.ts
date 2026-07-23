import postgres from "postgres";
import { assertEnv } from "../lib/env";

async function main(): Promise<void> {
    assertEnv(["CLIENT_TOKEN", "DATABASE_URL"]);

    const client = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5 });
    try {
        await client`select 1`;
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error("[Healthcheck] Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
});
