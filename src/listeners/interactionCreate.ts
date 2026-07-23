import { Events, Listener } from "@sapphire/framework";
import { MessageFlags, type Interaction } from "discord.js";
import { createPollComponents, createPollEmbed, getPoll, isPollExpired, recordPollVote } from "../lib/polls";

export class InteractionCreateListener extends Listener<typeof Events.InteractionCreate> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.InteractionCreate,
        });
    }

    public async run(interaction: Interaction): Promise<void> {
        if (!interaction.isButton() || !interaction.customId.startsWith("poll:")) return;

        const [, pollId, rawIndex] = interaction.customId.split(":");
        const optionIndex = Number.parseInt(rawIndex, 10);
        const poll = await getPoll(pollId);

        if (!poll || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
            await interaction.reply({ content: "That poll no longer exists.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (poll.closed || isPollExpired(poll)) {
            await interaction.reply({ content: "That poll is closed.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        await recordPollVote(poll, interaction.user.id, optionIndex);
        await interaction.update({
            embeds: [await createPollEmbed(poll)],
            components: createPollComponents(poll),
        });

        await interaction.followUp({
            content: `Your vote for **${poll.options[optionIndex]}** was recorded.`,
            flags: [MessageFlags.Ephemeral],
        }).catch(() => null);
    }
}
