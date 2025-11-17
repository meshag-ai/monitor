import pino from 'pino';

const pinoOptions: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
};

// if (process.env.NODE_ENV !== 'production') {
//     pinoOptions.transport = {
//         target: 'pino-pretty',
//         options: {
//             colorize: true,
//             ignore: 'pid,hostname',
//         },
//     };
// }

export const logger = pino(pinoOptions);
