import Message from '../../models/messages';
import { logger } from '../../utils/logger';

export const get_messages_by_conversation = async (conversation_id: string) => {
  try {
    const messages = await Message.find({ conversation_id })
      .sort({ created_at: 1 })
      .lean();
      
    logger.debug(`Lấy ${messages.length} tin nhắn của cuộc trò chuyện ${conversation_id}`);
    return messages;
  } catch (error) {
    logger.error('Lỗi khi lấy tin nhắn:', error);
    throw error;
  }
}; 