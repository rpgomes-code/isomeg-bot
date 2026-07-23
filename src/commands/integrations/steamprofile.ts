import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Colors, EmbedBuilder, Message, MessageFlags } from "discord.js";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { formatSteamMinutes, lookupSteamProfile } from "../../lib/steam";

export class SteamProfileCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "steamprofile",
            description: "Look up a Steam profile by SteamID, vanity name, or profile URL.",
            aliases: ["steam"],
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName("steamprofile")
                .setDescription("Look up a Steam profile by SteamID, vanity name, or profile URL.")
                .addStringOption((option) =>
                    option
                        .setName("profile")
                        .setDescription("SteamID64, vanity name, or Steam profile URL.")
                        .setRequired(true)
                ),
            { registerCommandIfMissing: true }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        createCommandLog({
            command: this.name,
            guild: interaction.guild?.name ?? "DM",
            type: CommandType.Slash,
            user: { username: interaction.user.username, displayName: interaction.user.displayName },
            createdAt: interaction.createdAt,
        });

        await interaction.deferReply();
        const profile = interaction.options.getString("profile", true);
        await this.replyWithProfile(profile, interaction);
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const profile = await args.rest("string").catch(() => null);
        if (!profile) {
            await message.reply("Usage: `$steam <steamid|vanity|profile-url>`");
            return;
        }

        await this.replyWithProfile(profile, message);
    }

    private async replyWithProfile(profileInput: string, target: ChatInputCommandInteraction | Message): Promise<void> {
        try {
            const profile = await lookupSteamProfile(profileInput);
            const embed = new EmbedBuilder()
                .setTitle(profile.personaName)
                .setURL(profile.profileUrl)
                .setColor(Colors.DarkAqua)
                .setThumbnail(profile.avatarUrl ?? null)
                .addFields([
                    { name: "SteamID64", value: profile.steamId, inline: false },
                    { name: "Profile", value: profile.visibilityState === 3 ? "Public" : "Private or friends-only", inline: true },
                    { name: "Games", value: profile.gameCount?.toLocaleString() ?? "Hidden", inline: true },
                ])
                .setTimestamp();

            if (profile.lastLogoff) {
                embed.addFields({ name: "Last Seen", value: `<t:${profile.lastLogoff}:R>`, inline: true });
            }

            if (profile.topGames.length > 0) {
                embed.addFields({
                    name: "Most Played Public Games",
                    value: profile.topGames.map((game, index) => `${index + 1}. ${game.name} - ${formatSteamMinutes(game.minutes)}`).join("\n"),
                    inline: false,
                });
            }

            if (target instanceof ChatInputCommandInteraction) {
                await target.editReply({ embeds: [embed] });
            } else {
                await target.reply({ embeds: [embed] });
            }
        } catch (error) {
            const content = error instanceof Error ? error.message : "Could not look up that Steam profile.";
            if (target instanceof ChatInputCommandInteraction) {
                if (content.includes("STEAM_API_KEY")) {
                    await target.editReply({ content: "Steam lookup is not configured yet. Add STEAM_API_KEY to enable it." });
                } else {
                    await target.editReply({ content });
                }
            } else {
                await target.reply(content.includes("STEAM_API_KEY") ? "Steam lookup is not configured yet. Add STEAM_API_KEY to enable it." : content);
            }
        }
    }
}
