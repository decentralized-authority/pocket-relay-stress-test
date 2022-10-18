import crypto from 'crypto';
import winston from 'winston';
import path from 'path';

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

export const createLogger = (): winston.Logger => {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.simple(),
    ),
    transports: [
      new winston.transports.Console(),
    ],
  });
};

export const createErrorLogger = (logDir: string): winston.Logger => {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.simple(),
    ),
    transports: [
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        maxsize: 4 * 1024000,
        maxFiles: 10,
      }),
    ],
  });
};
