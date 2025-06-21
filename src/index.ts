import {Client} from './core/client';
import {config} from './lib/config';

const client: Client = new Client();

client.login(config.botConfig.clientToken)