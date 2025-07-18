import { Socket } from 'socket.io';
import { logger } from '../utils/logger';

/**
 * Interface cho đối tượng lưu trữ socket request
 */
interface SocketRateLimitStore {
  [socket_id: string]: {
    message_count: number;
    last_reset: number;
    message_timestamps: number[];
    blocked_until?: number;
  };
}

/**
 * Store lưu trữ các request trong memory
 */
const socket_store: SocketRateLimitStore = {};

/**
 * Thời gian cửa sổ cho rate limiting (ms)
 */
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 phút

/**
 * Số lượng tin nhắn tối đa trong cửa sổ
 */
const MAX_MESSAGES_PER_WINDOW = 30; // 30 tin nhắn/phút

/**
 * Thời gian tối thiểu giữa các tin nhắn (ms)
 */
const MIN_MESSAGE_INTERVAL = 500; // 0.5 giây

/**
 * Thời gian block nếu vi phạm (ms)
 */
const BLOCK_DURATION = 30 * 1000; // 30 giây

/**
 * Rate limiter cho Socket.IO
 * @returns true nếu kết nối bị chặn, false nếu cho phép
 */
export const socket_rate_limiter = (socket: Socket): boolean => {
  const now = Date.now();
  const socket_id = socket.id;
  
  // Tạo entry mới cho mỗi kết nối
  socket_store[socket_id] = {
    message_count: 0,
    last_reset: now,
    message_timestamps: []
  };

  // Cho phép kết nối ban đầu
  return false;
};

/**
 * Kiểm tra và áp dụng rate limit cho mỗi tin nhắn
 * @returns true nếu message nên được chặn
 */
export const should_rate_limit_message = (socket_id: string): boolean => {
  const now = Date.now();
  
  // Nếu socket không được theo dõi
  if (!socket_store[socket_id]) {
    socket_store[socket_id] = {
      message_count: 0,
      last_reset: now,
      message_timestamps: []
    };
  }
  
  const client_data = socket_store[socket_id];
  
  // Kiểm tra nếu đang bị block
  if (client_data.blocked_until && now < client_data.blocked_until) {
    const remaining_seconds = Math.ceil((client_data.blocked_until - now) / 1000);
    logger.warn(`Socket rate limit: Client ${socket_id} is blocked. Remaining time: ${remaining_seconds}s`);
    return true;
  }
  
  // Reset counter nếu đã qua cửa sổ thời gian mới
  if (now - client_data.last_reset > RATE_LIMIT_WINDOW) {
    client_data.message_count = 0;
    client_data.last_reset = now;
    client_data.message_timestamps = [];
  }
  
  // Lấy timestamp tin nhắn gần nhất
  const last_message_time = client_data.message_timestamps.length > 0 
    ? client_data.message_timestamps[client_data.message_timestamps.length - 1]
    : 0;
    
  // Kiểm tra tần suất gửi tin nhắn quá nhanh
  if (now - last_message_time < MIN_MESSAGE_INTERVAL) {
    // Block socket vì gửi tin nhắn quá nhanh
    client_data.blocked_until = now + BLOCK_DURATION;
    logger.warn(`Socket rate limit: Client ${socket_id} is sending messages too fast. Blocked for ${BLOCK_DURATION/1000}s`);
    return true;
  }
  
  // Thêm timestamp của tin nhắn mới
  client_data.message_timestamps.push(now);
  
  // Giữ timestamps trong cửa sổ hiện tại
  client_data.message_timestamps = client_data.message_timestamps.filter(
    time => now - time < RATE_LIMIT_WINDOW
  );
  
  // Cập nhật số lượng tin nhắn
  client_data.message_count = client_data.message_timestamps.length;
  
  // Kiểm tra nếu vượt quá số lượng tin nhắn cho phép
  if (client_data.message_count > MAX_MESSAGES_PER_WINDOW) {
    client_data.blocked_until = now + BLOCK_DURATION;
    logger.warn(`Socket rate limit: Client ${socket_id} exceeded message limit. Blocked for ${BLOCK_DURATION/1000}s`);
    return true;
  }
  
  // Cho phép gửi tin nhắn
  return false;
};

/**
 * Làm sạch store khi socket ngắt kết nối
 */
export const cleanup_socket_store = (socket_id: string): void => {
  if (socket_store[socket_id]) {
    delete socket_store[socket_id];
  }
};

/**
 * Định kỳ làm sạch socket store để tránh memory leak
 */
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 phút
setInterval(() => {
  const now = Date.now();
  Object.keys(socket_store).forEach(socket_id => {
    const client_data = socket_store[socket_id];
    // Xóa socket không hoạt động trong thời gian dài
    if (now - client_data.last_reset > CLEANUP_INTERVAL && 
        (!client_data.blocked_until || client_data.blocked_until < now)) {
      delete socket_store[socket_id];
    }
  });
}, CLEANUP_INTERVAL); 