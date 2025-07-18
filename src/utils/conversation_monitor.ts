import { Server } from 'socket.io';
import Conversation, { IConversation } from '../models/conversation';
import { end_conversation } from '../controllers/conversation';
import { logger } from './logger';

/**
 * Thời gian không hoạt động tối đa cho một cuộc trò chuyện (ms)
 */
const IDLE_TIMEOUT = 60 * 1000; // 1 phút

/**
 * Khoảng thời gian kiểm tra các cuộc trò chuyện không hoạt động (ms)
 */
const CHECK_INTERVAL = 10 * 1000; // 10 giây

/**
 * Tiện ích giám sát và kết thúc các cuộc trò chuyện không hoạt động
 */
export class ConversationMonitor {
  private io: Server;
  private interval_id: NodeJS.Timeout | null = null;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Bắt đầu giám sát các cuộc trò chuyện
   */
  start(): void {
    logger.info('Bắt đầu giám sát các cuộc trò chuyện không hoạt động');
    
    // Đảm bảo không có nhiều interval chạy cùng lúc
    if (this.interval_id) {
      clearInterval(this.interval_id);
    }
    
    // Thiết lập interval để kiểm tra định kỳ
    this.interval_id = setInterval(() => {
      this.check_idle_conversations();
    }, CHECK_INTERVAL);
  }

  /**
   * Dừng giám sát các cuộc trò chuyện
   */
  stop(): void {
    if (this.interval_id) {
      clearInterval(this.interval_id);
      this.interval_id = null;
      logger.info('Đã dừng giám sát các cuộc trò chuyện');
    }
  }

  /**
   * Kiểm tra và kết thúc các cuộc trò chuyện không hoạt động
   */
  private async check_idle_conversations(): Promise<void> {
    try {
      const now = new Date();
      const idle_threshold = new Date(now.getTime() - IDLE_TIMEOUT);

      // Tìm các cuộc trò chuyện không hoạt động
      const idle_conversations = await Conversation.find({
        is_active: true,
        last_activity: { $lt: idle_threshold }
      }) as IConversation[];

      logger.debug(`Tìm thấy ${idle_conversations.length} cuộc trò chuyện không hoạt động`);

      // Kết thúc từng cuộc trò chuyện
      for (const conversation of idle_conversations) {
        try {
          // Thông báo cho các thành viên về việc cuộc trò chuyện kết thúc
          for (const participant_id of conversation.participants) {
            const socket = this.io.sockets.sockets.get(participant_id);
            if (socket) {
              logger.info(`Thông báo timeout cho người dùng ${participant_id}`);
              socket.emit('conversation-timeout', { 
                conversation_id: conversation._id.toString(),
                message: 'Cuộc trò chuyện đã kết thúc do không hoạt động trong 1 phút' 
              });
              
              // Không cần gửi sự kiện 'waiting' vì client sẽ tự động kết nối lại
            }
          }

          // Kết thúc cuộc trò chuyện
          await end_conversation(conversation._id.toString());
          logger.info(`Đã kết thúc cuộc trò chuyện ${conversation._id} do không hoạt động`);
        } catch (error) {
          logger.error(`Lỗi khi kết thúc cuộc trò chuyện ${conversation._id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Lỗi khi kiểm tra các cuộc trò chuyện không hoạt động:', error);
    }
  }
}

/**
 * Tạo và khởi động bộ giám sát cuộc trò chuyện
 */
export const setup_conversation_monitor = (io: Server): ConversationMonitor => {
  const monitor = new ConversationMonitor(io);
  monitor.start();
  return monitor;
}; 