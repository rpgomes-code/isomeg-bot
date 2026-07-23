import { SapphireClient } from "@sapphire/framework";
import type { Message } from "discord.js";
import { GatewayIntentBits, Partials } from "discord.js";
import { config } from "../constants/config";
import { DEFAULT_PREFIX } from "../constants/defaults";
import { ensureGuildSettings } from "../lib/guildSettings";

export class Client extends SapphireClient {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
            ],
            partials: [
                Partials.User,
                Partials.Message,
                Partials.Channel,
            ],
            presence: config.botConfig.presence,
            defaultPrefix: DEFAULT_PREFIX,
            fetchPrefix: async (message: Message) => {
                if (!message.guildId || !message.guild) {
                    return DEFAULT_PREFIX;
                }

                const settings = await ensureGuildSettings(message.guildId, message.guild.name);
                return settings.prefix;
            },
            defaultCooldown: {
                filteredUsers: [
                    ...config.adminUsers.map((user) => user.id),
                ],
            },
            loadMessageCommandListeners: true,
            loadApplicationCommandRegistriesStatusListeners: true,
            shards: "auto",
            typing: true,
        });
    }

    public override login(token: string) {
        return super.login(token);
    }
}
