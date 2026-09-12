interface RegisteredCommand {
    id: string;
    name: string;
    type: number;
}

interface CommandPermissions {
    id: string;
    permissions: unknown[];
}

export function findGuildCommandDuplicates<T extends RegisteredCommand>(
    globalCommands: T[], guildCommands: T[], permissions: CommandPermissions[],
) {
    const globals = new Map(globalCommands.map(command => [`${command.type}:${command.name}`, command]));
    return guildCommands.flatMap(guildCommand => {
        const globalCommand = globals.get(`${guildCommand.type}:${guildCommand.name}`);
        if (!globalCommand) return [];
        return [{
            guildCommand,
            globalCommand,
            hasPermissionOverrides: permissions.some(entry => entry.id === guildCommand.id && entry.permissions.length > 0),
        }];
    });
}
