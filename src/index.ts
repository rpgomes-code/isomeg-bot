import {Client} from './core/client';
import {config} from './constants/config';

const client: Client = new Client();

client.login(config.botConfig.clientToken)