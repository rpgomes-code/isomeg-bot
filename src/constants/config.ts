import dotenv from "dotenv";
import { ActivityType, PresenceData } from "discord.js";

dotenv.config();

const adminUsers = [
    {
        id: process.env.USER_ID_RPGOMES,
        name: "Rui Pedro Gomes",
        username: "rpgomes",
    },
    {
        id: process.env.USER_ID_JPEREIRA,
        name: "Joao Pedro Pereira",
        username: "jpereira",
    },
    {
        id: process.env.USER_ID_RPEREIRA,
        name: "Ricardo Jorge Pereira",
        username: "rpereira",
    },
].filter((user): user is { id: string; name: string; username: string } => Boolean(user.id));

export const config = {
    botConfig: {
        clientToken: process.env.CLIENT_TOKEN,
        requiredEnv: ["CLIENT_TOKEN", "DATABASE_URL"],
        presence: {
            status: "dnd",
            activities: [
                {
                    name: "Fallen Berserkers",
                    type: ActivityType.Competing,
                },
            ],
        } as PresenceData,
    },
    guilds: [
        {
            id: process.env.GUILD_ID_FALLEN_BERSERKERS,
            name: "Fallen Berserkers",
        },
    ],
    adminUsers,
};
