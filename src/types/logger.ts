import {CommandType} from "../enums/commands/general";

type UserLog = {
    username: string;
    displayName: string;
}

export type CommandLogOptions = {
    user: UserLog;
    guild: string;
    type: CommandType;
    command: string;
    createdAt: Date;
}

export type ListenerLogOptions = {
    user: UserLog;
    guild: string;
    type: string;
    createdAt: Date;
}