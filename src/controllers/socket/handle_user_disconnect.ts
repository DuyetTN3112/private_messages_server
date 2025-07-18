import { Socket, Server } from 'socket.io';
import { get_conversation_by_participant, end_conversation } from '../conversation';
import { waiting_queue, match_all_waiting_users } from './handle_new_user';
import { logger } from '../../utils/logger';
import { IConversation } from '../../models/conversation';
import { update_user_state } from './setup_socket_server';

export const handle_user_disconnect = async (socket: Socket, io: Server) => {
  logger.info(`Người dùng ngắt kết nối: ${socket.id}`);
  
  try {
    // Xóa người dùng khỏi hàng đợi nếu họ đang trong hàng đợi
    const updated_waiting_queue = waiting_queue.filter(s => s.id !== socket.id);
    
    if (waiting_queue.length > updated_waiting_queue.length) {
      logger.debug(`Người dùng ${socket.id} đã được xóa khỏi hàng đợi chờ`);
    }
    
    waiting_queue.length = 0;
    waiting_queue.push(...updated_waiting_queue);
    
    // Tìm cuộc trò chuyện của người dùng
    const conversation = await get_conversation_by_participant(socket.id) as IConversation;
    
    // Lấy socketStore từ req.app
    let socketStore = {};
    try {
      const req = socket.request as any;
      socketStore = req.app?.get('socketStore') || {};
    } catch (error) {
      logger.error('Không thể lấy socketStore:', error);
    }
    
    if (conversation) {
      // Tìm người còn lại trong cuộc trò chuyện
      const partner_id = conversation.participants.find(p => p !== socket.id);
      
      if (partner_id) {
        // Thông báo cho người còn lại rằng đối phương đã ngắt kết nối
        const partner_socket = io.sockets.sockets.get(partner_id);
        if (partner_socket) {
          partner_socket.emit('partner-disconnected');
          // Đưa người còn lại vào lại hàng đợi
          waiting_queue.push(partner_socket);
          partner_socket.emit('waiting');
          // Cập nhật trạng thái người dùng
          update_user_state(partner_id, 'waiting', io, socketStore);
          logger.info(`Đã thông báo cho người dùng ${partner_id} và đưa vào hàng đợi chờ`);
          
          // Thử ghép đôi ngay lập tức
          setTimeout(() => match_all_waiting_users(io), 500);
        }
      }
      
      // Kết thúc cuộc trò chuyện và xóa tất cả tin nhắn
      await end_conversation(conversation._id.toString());
    }
    
    // Cập nhật trạng thái người dùng ngắt kết nối
    update_user_state(socket.id, null, io, socketStore);
  } catch (error) {
    logger.error('Lỗi khi xử lý ngắt kết nối:', error);
  }
}; 