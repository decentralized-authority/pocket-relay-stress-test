import { RelayRequest, RelayResponse } from './interfaces';
import { getRandom, timeout } from './util';
import { PocketUtils } from './pocket-utils';

export class Runner {

  _pocketUtils: PocketUtils;
  _chainId: string;
  _requests: RelayRequest[]
  _length: number;
  _totalRequests: number;

  constructor(pocketUtils: PocketUtils, chainId: string, requests: RelayRequest[], length: number) {
    this._pocketUtils = pocketUtils;
    this._chainId = chainId;
    this._requests = [...requests];
    this._length = length;
    this._totalRequests = requests.length;
  }

  async start() {
    const responses: RelayResponse[] = [];
    await new Promise<void>(resolve => {
      const interval = (this._length * 60) / this._totalRequests;
      const requestInterval = setInterval(async () => {
        const [ currentRequest ] = this._requests.splice(0, 1);
        if(!currentRequest)
          return;
        const res = await this._pocketUtils.postRelay(this._chainId, currentRequest);
        responses.push(res);
        console.log(responses.length);
        if(responses.length === this._totalRequests) {
          clearInterval(requestInterval);
          resolve();
        }
      }, interval * 1000);
    });
    return responses
      .sort((a, b) => a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? 1 : -1);
  }

}
