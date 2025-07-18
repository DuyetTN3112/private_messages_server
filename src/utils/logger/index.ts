/**
 * Logger module cho ứng dụng
 * Phân biệt môi trường development và production
 * - Development: Log chi tiết lỗi
 * - Production: Log tổng quát, không tiết lộ chi tiết nhạy cảm
 */

// Kiểm tra môi trường
const is_production = process.env.NODE_ENV === 'production';

/**
 * Logger cho môi trường development
 */
const dev_logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARNING] ${message}`, ...args);
  },
  error: (message: string, error: Error | any, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, error, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    console.log(`[DEBUG] ${message}`, ...args);
  },
  // Log client-side chỉ trong development
  client_error: (message: string, error: Error | any) => {
    console.error(`[CLIENT ERROR] ${message}`, error);
  }
};

/**
 * Logger cho môi trường production
 * Không log chi tiết lỗi, chỉ log thông tin chung
 */
const prod_logger = {
  info: (message: string) => {
    console.log(`[INFO] ${message}`);
  },
  warn: (message: string) => {
    console.warn(`[WARNING] ${message}`);
  },
  error: (message: string, error: Error | any) => {
    // Log ID của lỗi để có thể tìm kiếm trong log system
    const error_id = generate_error_id();
    console.error(`[ERROR] ${message} (ID: ${error_id})`);
    
    // Ở đây có thể thêm các dịch vụ log như Sentry, LogRocket, etc.
  },
  debug: () => {}, // Không log debug trong production
  // Log client-side trong production không hiển thị chi tiết
  client_error: (message: string) => {
    // Không log chi tiết lỗi client-side trong production
  }
};

/**
 * Tạo ID duy nhất cho lỗi để dễ dàng tra cứu
 */
const generate_error_id = (): string => {
  return `err_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
};

/**
 * Chọn logger phù hợp với môi trường
 */
export const logger = is_production ? prod_logger : dev_logger;

/**
 * Format lỗi để hiển thị cho client
 * - Trong development: Trả về thông tin chi tiết
 * - Trong production: Trả về thông báo chung
 */
export const format_error_for_client = (error: Error | any): { message: string, details?: any } => {
  if (is_production) {
    return {
      message: 'Có lỗi xảy ra, vui lòng thử lại sau.'
    };
  } else {
    return {
      message: error.message || 'Lỗi không xác định',
      details: error.stack || error
    };
  }
};

export default logger; 