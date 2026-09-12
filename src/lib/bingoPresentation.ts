import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, escapeMarkdown,
    ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import type { BingoCard, BingoEvent } from "../db/schema";
import type { BingoView } from "./bingo";
import { BINGO_PREDICTION_LENGTH, BINGO_SIZE, completedLines, isMarked, markedCount, squareName } from "./bingoRules";

export function bingoCardPayload({ event, card }: BingoView) {
    const lines = completedLines(card.marks);
    const editable = event.status === "open" && !card.submittedAt;
    const markable = event.status === "live" && Boolean(card.submittedAt);
    const status = !card.submittedAt ? "Draft" : event.status === "open" ? "Submitted" : event.status === "live" ? "Live" : "Final";
    const embed = new EmbedBuilder()
        .setTitle(`${event.title} | Bingo`)
        .setColor(lines.length ? Colors.Green : Colors.DarkAqua)
        .setDescription([
            `Card by <@${card.createdById}> | **${status}**`,
            `**${markedCount(card.marks)}/25** marked | **${lines.length}** completed lines`,
            lines.length ? `**BINGO!** ${lines.join(", ")}` : "",
            `Event: \`${event.id}\``,
        ].filter(Boolean).join("\n"))
        .setFooter({ text: `Card ID: ${card.id} | Revision ${card.revision}` });

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let row = 0; row < BINGO_SIZE; row++) {
        const buttons = new ActionRowBuilder<ButtonBuilder>();
        const predictions: string[] = [];
        for (let col = 0; col < BINGO_SIZE; col++) {
            const index = row * BINGO_SIZE + col;
            const marked = isMarked(card.marks, index);
            const prediction = card.predictions[index];
            predictions.push(`**${squareName(index)}${marked ? " [X]" : ""}** ${escapeMarkdown(prediction || "(empty)")}`);
            buttons.addComponents(new ButtonBuilder()
                .setCustomId(`bingo:${editable ? "edit" : "mark"}:${card.id}:${card.revision}:${index}`)
                .setLabel(`${squareName(index)} ${prediction ? prediction.slice(0, 16) + (prediction.length > 16 ? "..." : "") : "+"}`)
                .setStyle(marked ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(!editable && !markable));
        }
        embed.addFields({ name: `Row ${row + 1}`, value: predictions.join("\n") });
        components.push(buttons);
    }
    return { embeds: [embed], components, allowedMentions: { parse: [] as [] } };
}

export function bingoEditModal(card: BingoCard, start: number, count: 1 | 5): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId(`bingo:save:${card.id}:${card.revision}:${start}:${count}`)
        .setTitle(count === 1 ? `Prediction ${squareName(start)}` : `Predictions for row ${Math.floor(start / BINGO_SIZE) + 1}`);
    for (let i = start; i < start + count; i++) {
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
            .setCustomId(`square-${i}`)
            .setLabel(`Square ${squareName(i)}`)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(BINGO_PREDICTION_LENGTH)
            .setRequired(false)
            .setValue(card.predictions[i])));
    }
    return modal;
}

export function bingoEventEmbed(event: BingoEvent): EmbedBuilder {
    return new EmbedBuilder().setTitle(escapeMarkdown(event.title)).setColor(Colors.DarkAqua)
        .setDescription(`Host: <@${event.createdById}>\nPhase: **${event.status}**\nEvent ID: \`${event.id}\``);
}

export function bingoResultsEmbed(event: BingoEvent, cards: BingoCard[], page: number): EmbedBuilder {
    const submitted = cards.filter(card => card.submittedAt).map(card => ({
        card, lines: completedLines(card.marks).length, marks: markedCount(card.marks),
    })).sort((a, b) => b.lines - a.lines || b.marks - a.marks || a.card.createdAt.getTime() - b.card.createdAt.getTime());
    const pages = Math.max(1, Math.ceil(submitted.length / 10));
    const current = Math.max(1, Math.min(page, pages));
    const offset = (current - 1) * 10;
    const rows = submitted.slice(offset, offset + 10).map(({ card, lines, marks }, index) =>
        `**${offset + index + 1}.** <@${card.createdById}> - **${lines}** lines, **${marks}/25** marked\nCard: \`${card.id}\``);
    return new EmbedBuilder().setTitle(`${event.title} | ${event.status === "ended" ? "Final results" : "Standings"}`)
        .setColor(Colors.DarkAqua).setDescription(rows.join("\n\n") || "No submitted cards yet.")
        .setFooter({ text: `Page ${current}/${pages} | ${submitted.length} submitted, ${cards.length - submitted.length} drafts | Self-reported marks` });
}
