import winston from 'winston';

export function createLogger(module: string) {
	return winston.createLogger({
		level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
		format: winston.format.combine(
			winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
			winston.format.json(),
		),
		defaultMeta: { module },
		transports: [new winston.transports.Console()],
	});
}

export const logger = createLogger('App');
