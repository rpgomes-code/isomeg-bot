import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { REST, Routes, type APIApplication, type APIApplicationCommand, type APIGuildApplicationCommandPermissions } from "discord.js";
import { findGuildCommandDuplicates } from "../lib/commandRegistrations";

async function main(): Promise<void> {
    const { values } = parseArgs({ options: { guild: { type: "string" }, apply: { type: "boolean", default: false } } });
    const guildId = values.guild;
    if (!guildId || !/^\d{17,20}$/.test(guildId)) {
        throw new Error("Usage: node dist/scripts/manageCommands.js --guild <server-id> [--apply]");
    }
    if (!process.env.CLIENT_TOKEN) throw new Error("CLIENT_TOKEN is required.");

    // REST-only maintenance avoids connecting another bot instance or re-registering commands.
    const rest = new REST({ version: "10" }).setToken(process.env.CLIENT_TOKEN);
    const application = await rest.get(Routes.oauth2CurrentApplication()) as APIApplication;
    const globalRoute = Routes.applicationCommands(application.id);
    const guildRoute = Routes.applicationGuildCommands(application.id, guildId);
    const permissionRoute = Routes.guildApplicationCommandsPermissions(application.id, guildId);
    const globalCommands = await rest.get(globalRoute) as APIApplicationCommand[];
    const guildCommands = await rest.get(guildRoute) as APIApplicationCommand[];
    const permissions = await rest.get(permissionRoute) as APIGuildApplicationCommandPermissions[];
    const duplicates = findGuildCommandDuplicates(globalCommands, guildCommands, permissions);
    const removable = duplicates.filter(entry => !entry.hasPermissionOverrides);

    console.log(`Application: ${application.name} (${application.id}); server: ${guildId}`);
    console.log(`${globalCommands.length} global, ${guildCommands.length} server commands; ${duplicates.length} duplicates.`);
    for (const entry of duplicates) {
        console.log(`${entry.hasPermissionOverrides ? "SKIP (custom permissions)" : "REMOVE SERVER COPY"}: ${entry.guildCommand.name} (${entry.guildCommand.id}); keep global ${entry.globalCommand.id}`);
    }
    if (!values.apply) {
        console.log("Preview only. Add --apply to remove the listed server copies without custom permissions.");
        return;
    }
    if (!removable.length) {
        console.log("No server copies to remove.");
        return;
    }

    const backupDirectory = resolve("backups/command-registrations");
    await mkdir(backupDirectory, { recursive: true });
    const backupPath = resolve(backupDirectory, `${application.id}-${guildId}-${Date.now()}.json`);
    await writeFile(backupPath, JSON.stringify({
        applicationId: application.id, guildId, capturedAt: new Date().toISOString(), globalCommands, guildCommands, permissions,
    }, null, 2), { flag: "wx", mode: 0o600 });
    console.log(`Registration backup: ${backupPath}`);

    for (const { guildCommand, globalCommand } of removable) {
        const currentGlobal = await rest.get(Routes.applicationCommand(application.id, globalCommand.id)) as APIApplicationCommand;
        const currentGuild = await rest.get(Routes.applicationGuildCommand(application.id, guildId, guildCommand.id)) as APIApplicationCommand;
        const currentPermissions = await rest.get(permissionRoute) as APIGuildApplicationCommandPermissions[];
        const [duplicate] = findGuildCommandDuplicates([currentGlobal], [currentGuild], currentPermissions);
        if (!duplicate || duplicate.hasPermissionOverrides) {
            throw new Error(`Registration changed for ${guildCommand.name}; cleanup stopped. Run the preview again.`);
        }
        await rest.delete(Routes.applicationGuildCommand(application.id, guildId, guildCommand.id));
        console.log(`Removed server copy: ${guildCommand.name}`);
    }

    const remainingGlobal = await rest.get(globalRoute) as APIApplicationCommand[];
    const remainingGuild = await rest.get(guildRoute) as APIApplicationCommand[];
    const globalIds = new Set(remainingGlobal.map(command => command.id));
    if (globalCommands.some(command => !globalIds.has(command.id))) {
        throw new Error("The global command list changed during cleanup. Inspect registrations before continuing.");
    }
    const remainingDuplicates = findGuildCommandDuplicates(remainingGlobal, remainingGuild, permissions);
    console.log(`Verified: all ${globalCommands.length} original global commands retained; ${remainingDuplicates.length} server duplicates remain.`);
}

main().catch(error => {
    // REST errors can contain request metadata, so do not log entire error objects.
    console.error(error instanceof Error ? error.message : "Command cleanup failed.");
    process.exitCode = 1;
});
