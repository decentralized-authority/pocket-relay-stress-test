import { RelayRequest, RelayResponse } from './interfaces';
import { getRandom, timeout } from './util';
import { PocketUtils } from './pocket-utils';

export class Runner {

  _pocketUtils: PocketUtils;
  _chainId: string;
  _requests: RelayRequest[]
  _length: number;
  _rps: number;
  _totalRequests: number;

  constructor(pocketUtils: PocketUtils, chainId: string, requests: RelayRequest[], length: number) {
    this._pocketUtils = pocketUtils;
    this._chainId = chainId;
    this._requests = [...requests];
    this._length = length;
    this._totalRequests = requests.length;
    this._rps = requests.length / (length * 60);
  }

  async start() {
    const responses: RelayResponse[] = [];
    await new Promise<void>(resolve => {
      const requestInterval = setInterval(async () => {
        const currentRequests = this._requests.splice(0, this._rps);
        const res = await Promise.all(currentRequests
          .map(r => this._pocketUtils.postRelay(
            this._chainId,
            r
          )));
        for(const r of res) {
          responses.push(r);
        }
        console.log(responses.length);
        if(responses.length === this._totalRequests) {
          clearInterval(requestInterval);
          resolve();
        }
      }, 1000);
    });
    return responses
      .sort((a, b) => a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? 1 : -1);
  }

}
