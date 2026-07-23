import { Player } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import { container } from "@sapphire/pieces";

export async function createPlayer(): Promise<Player> {
    const player = new Player(container.client);
    await player.extractors.loadMulti(DefaultExtractors);

    player.events.on("playerStart", (queue, track) => {
        container.logger.info(
            `[Player] Now playing "${track.title}" in guild ${queue.guild.name}`
        );
    });

    player.events.on("error", (queue, error) => {
        container.logger.error(
            `[Player] Error in queue ${queue.guild.name}: ${error.message}`
        );
    });

    player.events.on("disconnect", (queue) => {
        container.logger.info(
            `[Player] Disconnected from voice in guild ${queue.guild.name}`
        );
    });

    player.events.on("emptyQueue", (queue) => {
        container.logger.info(
            `[Player] Queue empty for guild ${queue.guild.name}`
        );
    });

    return player;
}

export function getPlayer(): Player {
    return container.player as Player;
}
