import { Socket, Server } from 'socket.io';
import { get_conversation_by_participant } from '../conversation';
import { save_message } from '../message';
import { logger } from '../../utils/logger';
import { validate_message, sanitize_message } from '../../validators/message_validator';
import { should_rate_limit_message } from '../../middleware/socket_rate_limiter';
import { IConversation } from '../../models/conversation';

export const handle_send_message = async (socket: Socket, io: Server, content: string) => {
  try {
    logger.debug(`Socket ${socket.id} đang gửi tin nhắn: "${content}"`);
    
    // Kiểm tra rate limit
    if (should_rate_limit_message(socket.id)) {
      socket.emit('error', { message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng thử lại sau.' });
      logger.warn(`Rate limit triggered for socket ${socket.id}`);
      return;
    }
    
    // Kiểm tra và làm sạch nội dung tin nhắn
    try {
      // Validate tin nhắn
      validate_message(content);
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Nội dung tin nhắn không hợp lệ' });
      logger.warn(`Invalid message from socket ${socket.id}: ${error.message}`);
      return;
    }
    
    // Làm sạch nội dung
    const sanitized_content = sanitize_message(content);
    
    // Tìm cuộc trò chuyện của người dùng
    const conversation = await get_conversation_by_participant(socket.id) as IConversation;
    
    if (!conversation) {
      logger.error(`Không tìm thấy cuộc trò chuyện cho socket ${socket.id}`);
      socket.emit('error', { message: 'Không tìm thấy cuộc trò chuyện' });
      return;
    }
    
    logger.debug(`Tìm thấy cuộc trò chuyện ${conversation._id} cho socket ${socket.id}`);
    
    // Lưu tin nhắn vào cơ sở dữ liệu
    const message = await save_message(conversation._id.toString(), socket.id, sanitized_content);
    logger.debug(`Đã lưu tin nhắn vào cơ sở dữ liệu với ID ${message._id}`);
    
    // Hiển thị tất cả các phòng mà socket này tham gia
    const socketRooms = Array.from(io.sockets.adapter.sids.get(socket.id) || []);
    logger.debug(`Socket ${socket.id} đang ở trong các phòng: ${socketRooms.join(', ')}`);
    
    // Lấy danh sách các socket trong phòng
    const room = io.sockets.adapter.rooms.get(conversation._id.toString());
    const socketsInRoom = room ? Array.from(room) : [];
    logger.debug(`Các socket trong phòng ${conversation._id}: ${socketsInRoom.join(', ')}`);
    
    // Gửi tin nhắn cho tất cả người tham gia trong cuộc trò chuyện
    logger.debug(`Gửi tin nhắn đến phòng ${conversation._id.toString()}`);
    io.to(conversation._id.toString()).emit('receive-message', {
      sender_id: socket.id,
      content: sanitized_content,
      created_at: message.created_at
    });
    
    // Không gửi trực tiếp cho đối tác nữa vì sẽ gây ra trùng lặp tin nhắn
  } catch (error) {
    logger.error('Lỗi khi gửi tin nhắn:', error);
    socket.emit('error', { message: 'Có lỗi xảy ra khi gửi tin nhắn' });
  }
}; 