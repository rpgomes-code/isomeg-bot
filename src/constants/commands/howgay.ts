import {RarityLevel} from "../../types/commands/howgay";
import {Colors} from "discord.js";

export const rarityLevels: RarityLevel[] = [
    {
        id: "impossible",
        color: Colors.Red,
        label: "Almost Impossible!",
        emoji: "💀",
    },
    {
        id: "rare",
        color: Colors.Grey,
        label: "Rare",
        emoji: "⚪",
    },
    {
        id: "uncommon",
        color: Colors.Green,
        label: "Uncommon",
        emoji: "🟢",
    },
    {
        id: "very_rare",
        color: Colors.Purple,
        label: "Very Rare",
        emoji: "⭐",
    },
    {
        id: "extra_rare",
        color: Colors.Gold,
        label: "EXTRA RARE!!!",
        emoji: "🌟",
    }
]