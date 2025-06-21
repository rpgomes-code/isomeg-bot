import { Client, GatewayIntentBits } from 'discord.js';
import {config} from "../constants/config";

async function clearDuplicateCommands() {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    await client.login(process.env.CLIENT_TOKEN);

    console.log('🧹 Clearing duplicate commands...');

    try {
        // Clear global commands
        console.log('Clearing global commands...');
        await client.application?.commands.set([]);

        // Clear guild commands for each guild
        const guilds = [...config.guilds.map(guild => guild.id)]; // Replace with your actual guild IDs

        for (const guildId of guilds) {
            console.log(`Clearing commands for guild ${guildId}...`);
            const guild = await client.guilds.fetch(guildId);
            await guild.commands.set([]);
        }

        console.log('✅ All duplicate commands cleared!');
        console.log('🔄 Now restart your main bot to re-register commands properly.');

    } catch (error) {
        console.error('❌ Error clearing commands:', error);
    } finally {
        client.destroy();
    }
}


clearDuplicateCommands();