import dotenv from 'dotenv';
import {ActivityType, PresenceData} from 'discord.js';
dotenv.config();

export const config = {
    botConfig: {
        clientToken: process.env.CLIENT_TOKEN,
        presence: {
            status: 'dnd',
            activities: [
                {
                    name: "Pornhub",
                    type: ActivityType.Competing,
                }
            ]
        } as PresenceData
    },
    guilds: [
        {
            id: process.env.GUILD_ID_FALLEN_BERSERKERS,
            name: "Fallen Berserkers",
        }
    ],
    adminUsers: [
        {
            id: process.env.USER_ID_RPGOMES,
            name: "Rui Pedro Gomes",
            username: "rpgomes"
        },
        {
            id: process.env.USER_ID_JPEREIRA,
            name: "João Pedro Pereira",
            username: "jpereira"
        },
        {
            id: process.env.USER_ID_RPEREIRA,
            name: "Ricardo Jorge Pereira",
            username: "rpereira"
        },
    ],
}