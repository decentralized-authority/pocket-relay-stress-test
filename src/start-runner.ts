import { PocketUtils } from './pocket-utils';
import { logError } from './util';
import { RelayRequest } from './interfaces';
import { Runner } from './runner';

const [] = process.argv;

let endpoint = '';
let chainId = '';
let requestsJson = '';
let res = '';

process.on('message', message => {
  const { endpoint, chainId, length, requests } = message as {endpoint: string, chainId: string, length: number, requests: RelayRequest[]};
  const pocketUtils = new PocketUtils(endpoint, err => logError(err));
  const runner = new Runner(pocketUtils, chainId, requests, length);
  runner.start()
    .then(res => {
      if(process.send)
        process.send(res);
    })
    .catch(logError);
});
