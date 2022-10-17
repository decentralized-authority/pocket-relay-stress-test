import { PocketUtils } from './pocket-utils';
import { isError, isString } from 'lodash';
import { getRandom, getRandomInt, logError } from './util';
import { ProcessMessage, RelayRequest, RelayResponse } from './interfaces';
import { Runner } from './runner';
import { fork } from 'child_process';
import path from 'path';
import { messageEvent } from './constants';
import colors from 'colors/safe';
import { stdout as log } from 'single-line-log';
import request from 'superagent';

const startRunner = (endpoint: string, chainId: string, length: number, requests: RelayRequest[], isChainEndpoint: boolean, onResponse: (response: RelayResponse)=>void, onError: (err: any)=>void): Promise<RelayResponse[]> => {
  return new Promise((resolve, reject) => {
    const instance = fork(path.join(__dirname, 'start-runner'));
    instance.on('message', message => {
      const { event, payload } = message as ProcessMessage;
      if(event === messageEvent.RESPONSES) {
        resolve(payload as RelayResponse[]);
        instance.kill();
      } else if(event === messageEvent.RESPONSE) {
        onResponse(payload as RelayResponse);
      } else if(event === messageEvent.ERROR) {
        onError(payload);
      }
    });
    instance.on('error', reject);
    instance.send({
      event: messageEvent.REQUESTS,
      payload: {endpoint, chainId, length, requests, isChainEndpoint}
    });
  });
};

const start = async function() {

  const {
    ENDPOINT: endpoint = 'http://localhost:8081',
  } = process.env;

  const chainId = '0021';
  const length = 1;
  const totalRequests = 60;
  const instances = 1;

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
  let isChainEndpoint = false;

  if(!version || !isString(version)) {
    let body: any;
    try {
      const res = await request
        .post(endpoint)
        .type('application/json')
        .timeout(10000)
        .send({
          id: getRandom(),
          jsonrpc: '2.0',
          method: 'net_version',
          params: [],
        });
      body = res.body;
    } catch(err) {
      throw new Error(`Unable to reach endpoint ${endpoint}`);
    }
    if(body?.error) {
      throw new Error(JSON.stringify(body.error));
    }
    isChainEndpoint = true;
  }

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
        // method: 'net_version',
        params: [],
        // method: 'eth_getBlockByNumber',
        // params: ['0x' + (startingBlock - offset).toString(16), false],
      }),
      method: 'POST',
      path: '/',
      headers: {},
    });
  }

  const allResponses: RelayResponse[] = [];

  let percentComplete = -1;
  const onResponse = (response: RelayResponse) => {
    allResponses.push(response);
    const percent = Math.floor((allResponses.length / totalRequests) * 100);
    if(percent !== percentComplete) {
      let percentStr = percent.toString(10);
      while(percentStr.length < 3) {
        percentStr = ' ' + percentStr;
      }
      percentComplete = percent;
      log(`${percentStr}% ${colors.grey('complete')}`);
    }
  };

  const totalRequestsForRunner = totalRequests / instances;
  const runners = [];
  for(let i = 0; i < instances; i++) {
    const start = i * totalRequestsForRunner;
    const runnerRequests = allRequests.slice(start, start + totalRequestsForRunner);
    runners.push(() => startRunner(endpoint, chainId, length, runnerRequests, isChainEndpoint, onResponse, err => logError(err)));
  }

  await Promise.all(runners.map(r => r()));

  const sortedResponses: RelayResponse[] = allResponses
    .sort((a, b) => a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? 1 : -1);

  // console.log(sortedResponses[0]);
  // console.log(sortedResponses[Math.floor(sortedResponses.length / 2)]);
  // console.log(sortedResponses[sortedResponses.length - 1]);

  const successResponses = sortedResponses.filter(r => !r.error);
  const errorResponses = sortedResponses.filter(r => !!r.error);

  const averageDuration = successResponses.reduce((sum, r) => sum + r.duration, 0) / successResponses.length;

  const durationColor = averageDuration < 100 ? colors.green : averageDuration < 1000 ? colors.yellow : colors.red;

  console.log('\n');
  console.log(`average duration:  ${durationColor(averageDuration.toFixed(3))}`);
  console.log(` reqs per second:  ${instances * totalRequestsForRunner / (length * 60)}`);
  console.log(`  total requests:  ${sortedResponses.length}`);
  console.log(`   success count:  ${colors.green(successResponses.length.toString(10))}`);
  console.log(`     error count:  ${errorResponses.length > 0 ? colors.red(errorResponses.length.toString(10)) : errorResponses.length.toString(10)}`);

};

start()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
