import Conversation from '../../models/conversation';
import { logger } from '../../utils/logger';

export const get_conversation_by_participant = async (socket_id: string) => {
  try {
    return await Conversation.findOne({ 
      participants: socket_id,
      is_active: true
    });
  } catch (error) {
    logger.error('Lỗi khi tìm conversation:', error);
    throw error;
  }
}; 