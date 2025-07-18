import Conversation from '../../models/conversation';
import Message from '../../models/messages';
import { logger } from '../../utils/logger';

export const end_conversation = async (conversation_id: string) => {
  try {
    // Tìm và xóa tất cả tin nhắn trong cuộc trò chuyện
    const result = await Message.deleteMany({ conversation_id });
    logger.info(`Đã xóa ${result.deletedCount} tin nhắn của cuộc trò chuyện ${conversation_id}`);
    
    // Xóa cuộc trò chuyện
    await Conversation.findByIdAndDelete(conversation_id);
    logger.info(`Đã kết thúc cuộc trò chuyện ${conversation_id}`);
    
    return true;
  } catch (error) {
    logger.error('Lỗi khi kết thúc conversation:', error);
    throw error;
  }
}; 