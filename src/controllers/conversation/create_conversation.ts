import Conversation from '../../models/conversation';
import { logger } from '../../utils/logger';

export const create_conversation = async (socket_ids: string[]) => {
  try {
    const conversation = new Conversation({
      participants: socket_ids,
      is_active: true,
      last_activity: new Date()
    });
    
    await conversation.save();
    logger.info(`Đã tạo cuộc trò chuyện mới giữa ${socket_ids[0]} và ${socket_ids[1]}`);
    return conversation;
  } catch (error) {
    logger.error('Lỗi khi tạo conversation:', error);
    throw error;
  }
}; 