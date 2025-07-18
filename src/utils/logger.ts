import winston from 'winston';

// Cấu hình logger với chỉ log ra console, không lưu file
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  defaultMeta: { service: 'private-messages' },
  transports: [
    new winston.transports.Console()
  ],
});

// Không còn cần điều kiện này vì luôn log ra console
// if (process.env.NODE_ENV !== 'production') {
//   logger.add(new winston.transports.Console({
//     format: winston.format.combine(
//       winston.format.colorize(),
//       winston.format.simple()
//     ),
//   }));
// }

export { logger }; 