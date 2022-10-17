import crypto from 'crypto';
import { isError, isPlainObject, isString } from 'lodash';
import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';

export const getRandom = (): string => {
  const buf = crypto.randomBytes(8);
  return buf.toString('hex');
};

export const getRandomInt = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

export const timeout = (length = 0) =>  new Promise(resolve => setTimeout(resolve, length));

const logDir = path.resolve(__dirname, '../log');
fs.ensureDirSync(logDir);
const errorLogFilePath = path.join(logDir, 'error.log');

const errorLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple(),
  ),
  transports: [
    new winston.transports.File({
      filename: errorLogFilePath,
      maxsize: 4 * 1024000,
      maxFiles: 10,
    }),
  ],
})

export const logInfo = (message: string): void => {
  console.log(message);
};

export const logError = (err: any): void => {
  if(isString(err)) {
    errorLogger.error(err);
  } else if(isError(err) || (err?.message && err?.stack)) {
    errorLogger.error(`${err?.message}\n${err?.stack}`);
  } else {
    console.error(err);
  }
};
