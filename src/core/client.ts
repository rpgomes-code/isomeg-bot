import {SapphireClient} from '@sapphire/framework';
import {GatewayIntentBits, Partials} from 'discord.js';
import {config} from '../constants/config';

export class Client extends SapphireClient {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessages
            ],
            partials: [
                Partials.User,
                Partials.Message,
                Partials.Channel
            ],
            presence: config.botConfig.presence,
            defaultPrefix: "$",
            defaultCooldown: {
                filteredUsers: [
                    ...config.adminUsers.map(user => user.id)
                ]
            },
            loadMessageCommandListeners: true,
            loadApplicationCommandRegistriesStatusListeners: true,
            shards: "auto",
            typing: true
        });
    }

    public override login(token: string) {
        return super.login(token);
    }
}