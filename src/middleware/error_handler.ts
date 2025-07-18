import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom error class với status code
 */
export class ApiError extends Error {
  status_code: number;
  
  constructor(message: string, status_code: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status_code = status_code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware bắt các lỗi 404 (Not Found)
 */
export const not_found_handler = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(`Không tìm thấy đường dẫn: ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Middleware xử lý các lỗi chung trong ứng dụng
 */
export const error_handler = (err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
  // Lấy status code nếu có, mặc định là 500
  const status_code = (err as ApiError).status_code || 500;
  
  // Log lỗi với các thông tin phù hợp
  logger.error(`${status_code} - ${err.message}`, err);
  
  // Format lỗi để trả về client
  const error_response = {
    message: err.message,
    status: status_code
  };
  
  // Trả về response
  res.status(status_code).json(error_response);
};

/**
 * Middleware bắt lỗi promise không được xử lý
 */
export const unhandled_rejection_handler = (
  reason: Error,
  promise: Promise<any>
) => {
  logger.error('Unhandled Rejection at Promise', reason);
  // Thông thường ở đây nên kết thúc process với exit code 1
  // Nhưng trong môi trường production, có thể chỉ log và tiếp tục
  if (process.env.NODE_ENV !== 'production') {
    console.error('Shutting down due to unhandled promise rejection');
    process.exit(1);
  }
};

/**
 * Middleware bắt lỗi không được xử lý
 */
export const uncaught_exception_handler = (err: Error) => {
  logger.error('Uncaught Exception', err);
  // Trong trường hợp có uncaught exception, nên kết thúc process
  process.exit(1);
};

/**
 * Đăng ký các handler cho unhandled rejection và uncaught exception
 */
export const register_error_handlers = () => {
  process.on('unhandledRejection', unhandled_rejection_handler);
  process.on('uncaughtException', uncaught_exception_handler);
}; 