import {CommandLogOptions, ListenerLogOptions} from "../types/logger";
import {formatDateTime} from "./utils";
import {container} from "@sapphire/pieces";

export function createCommandLog(options: CommandLogOptions) {
    const formattedDate = formatDateTime(options.createdAt);

    container.logger.info(`${options.user.username} (${options.user.displayName}) - ${options.guild} - ${options.type} - ${options.command} - ${formattedDate}`);
}

export function createListenerLog(options: ListenerLogOptions) {
    const formattedDate = formatDateTime(options.createdAt);

    container.logger.info(`${options.user.username} (${options.user.displayName}) - ${options.guild} - ${options.type} - ${formattedDate}`);
}