import Message from '../../models/messages';
import Conversation from '../../models/conversation';
import { logger } from '../../utils/logger';

export const save_message = async (conversation_id: string, sender: string, content: string) => {
  try {
    const message = new Message({
      conversation_id,
      sender,
      content
    });
    
    await message.save();
    
    await Conversation.findByIdAndUpdate(conversation_id, {
      last_activity: new Date()
    });
    
    logger.debug(`Tin nhắn mới lưu thành công - Conversation: ${conversation_id}, Sender: ${sender}`);
    return message;
  } catch (error) {
    logger.error('Lỗi khi lưu tin nhắn:', error);
    throw error;
  }
}; 