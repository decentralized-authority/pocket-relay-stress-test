import { PocketUtils } from './pocket-utils';
import { isError, isString } from 'lodash';
import { getRandom, getRandomInt, logError } from './util';
import { RelayRequest, RelayResponse } from './interfaces';
import { Runner } from './runner';
import { fork } from 'child_process';
import path from 'path';

const startRunner = (endpoint: string, chainId: string, length: number, requests: RelayRequest[]): Promise<RelayResponse[]> => {
  return new Promise((resolve, reject) => {
    const instance = fork(path.join(__dirname, 'start-runner'));
    instance.on('message', message => {
      resolve(message as RelayResponse[]);
      instance.kill();
    });
    instance.on('error', reject);
    instance.send({endpoint, chainId, length, requests});
  });
};

const start = async function() {

  const {
    PRST_POCKET_ENDPOINT: endpoint = 'http://localhost:8081',
  //   PRST_INSTANCE_NUM = '1',
  //   PRST_INSTANCE_RPS = '1',
  //   PRST_CHAIN_ID = '0021'
  //    PRST_CHAIN_ID = '0009'
  } = process.env;
  // const instanceNum = parseInt(PRST_INSTANCE_NUM);
  // const rps = parseInt(PRST_INSTANCE_RPS);
  // const chainId = PRST_CHAIN_ID;

  const chainId = '0021';
  const length = 1;
  const totalRequests = 1200;
  const instances = 2;

  let startingBlock: number;

  switch(chainId) {
    case '0021':
      startingBlock = 15707838;
      break;
    // case '0009':
    //   startingBlock = 34154363;
    //   break;
    default:
      throw new Error(`Unsupported chain ID ${chainId}`);
  }

  const pocketUtils = new PocketUtils(endpoint, err => logError(err));

  const version = await pocketUtils.getVersion();

  if(!version)
    throw new Error(`Unable to reach Pocket endpoint ${endpoint}`);

  // const res = await pocketUtils.postRelay(
  //   chainId,
  //   {
  //     data: JSON.stringify({
  //       id: getRandom(),
  //       jsonrpc: '2.0',
  //       method: 'eth_getBlockByNumber',
  //       params: [15707838, false]
  //     }),
  //     method: 'POST',
  //     path: '/',
  //     headers: {}
  //   }
  // );

  const allRequests: RelayRequest[] = [];

  for(let i = 0; i < totalRequests; i++) {
    const offset = getRandomInt(0, 1000);
    allRequests.push({
      data: JSON.stringify({
        id: getRandom(),
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        // method: 'eth_getBlockByNumber',
        // params: ['0x' + (startingBlock - offset).toString(16), false],
      }),
      method: 'POST',
      path: '/',
      headers: {},
    });
  }

  const totalRequestsForRunner = totalRequests / instances;
  const runners = [];
  for(let i = 0; i < instances; i++) {
    const start = i * totalRequestsForRunner;
    const runnerRequests = allRequests.slice(start, start + totalRequestsForRunner);
    runners.push(() => startRunner(endpoint, chainId, length, runnerRequests));
  }

  const allResponses: RelayResponse[][] = await Promise.all(runners.map(r => r()));

  const sortedResponses: RelayResponse[] = allResponses
    .reduce((joined, arr) => [...joined, ...arr])
    .sort((a, b) => a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? 1 : -1);

  // console.log(sortedResponses[0]);
  // console.log(sortedResponses[Math.floor(sortedResponses.length / 2)]);
  // console.log(sortedResponses[sortedResponses.length - 1]);

  const averageDuration = sortedResponses.reduce((sum, r) => sum + r.duration, 0) / sortedResponses.length;

  console.log(`\n reqs per second:  ${totalRequestsForRunner / (length * 60)}`);
  console.log(`average duration:  ${averageDuration}`);
  console.log(`  total requests:  ${sortedResponses.length}`);
  console.log(`   success count:  ${sortedResponses.filter(r => !r.error).length}`);
  console.log(`     error count:  ${sortedResponses.filter(r => !!r.error).length}`);

  console.log('\nDone!');

};

start()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
