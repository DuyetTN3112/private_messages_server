import { Server, Socket } from 'socket.io';
import { handle_new_user, match_all_waiting_users } from './handle_new_user';
import { handle_send_message } from './handle_send_message';
import { handle_user_disconnect } from './handle_user_disconnect';
import { socket_rate_limiter, cleanup_socket_store } from '../../middleware/socket_rate_limiter';
import { logger } from '../../utils/logger';

// Hàm để cập nhật thống kê người dùng
const update_user_stats = (io: Server) => {
  const online_users = io.engine.clientsCount || 0;
  const waiting_users = Array.from(io.sockets.adapter.rooms.get('waiting') || []).length;
  
  // Gửi thông tin cho tất cả client
  io.emit('user-stats', {
    online_users,
    waiting_users
  });
  
  logger.info(`Thống kê người dùng: ${online_users} trực tuyến, ${waiting_users} đang chờ`);
};

// Cập nhật trạng thái người dùng
export const update_user_state = (socket_id: string, state: 'waiting' | 'matched' | null, io: Server, socketStore: { [socket_id: string]: 'waiting' | 'matched' | null }) => {
  if (state === null) {
    delete socketStore[socket_id];
  } else {
    socketStore[socket_id] = state;
  }
  update_user_stats(io);
};

// Xử lý khi người dùng thêm phản ứng vào tin nhắn
const handle_add_reaction = (socket: Socket, io: Server, data: { conversation_id: string, message_index: number, emoji: string }) => {
  try {
    const { conversation_id, message_index, emoji } = data;
    
    logger.info(`Người dùng ${socket.id} thêm phản ứng ${emoji} vào tin nhắn ${message_index} trong cuộc trò chuyện ${conversation_id}`);
    
    // Hiển thị danh sách phòng mà socket này thuộc về
    const socketRooms = Array.from(socket.rooms);
    logger.debug(`Socket ${socket.id} đang ở trong các phòng: ${socketRooms.join(', ')}`);
    
    // Kiểm tra xem phòng cuộc trò chuyện có tồn tại không
    const room = io.sockets.adapter.rooms.get(conversation_id);
    
    if (room) {
      logger.debug(`Phòng ${conversation_id} tồn tại với ${room.size} thành viên`);
      
      // Liệt kê tất cả các socket trong phòng
      const socketsInRoom = Array.from(room);
      logger.debug(`Các socket trong phòng ${conversation_id}: ${socketsInRoom.join(', ')}`);
      
      // Đảm bảo socket hiện tại đang ở trong phòng, nếu không thì cho join
      if (!socket.rooms.has(conversation_id)) {
        logger.debug(`Socket ${socket.id} không ở trong phòng ${conversation_id}, tự động thêm vào`);
        socket.join(conversation_id);
      }
      
      // Gửi phản ứng đến tất cả thành viên trong phòng (bao gồm cả người gửi)
      io.to(conversation_id).emit('receive-reaction', {
        message_index,
        emoji
      });
      
      logger.info(`Đã gửi phản ứng đến phòng ${conversation_id}`);
    } else {
      logger.warn(`Không tìm thấy phòng ${conversation_id}`);
      
      // Nếu phòng không tồn tại, tự động tạo phòng và thêm socket hiện tại vào
      socket.join(conversation_id);
      logger.debug(`Đã tạo phòng mới ${conversation_id} và thêm socket ${socket.id}`);
      
      // Gửi phản ứng đến phòng (chỉ có socket hiện tại)
      io.to(conversation_id).emit('receive-reaction', {
        message_index,
        emoji
      });
    }
  } catch (error) {
    logger.error('Lỗi khi xử lý phản ứng:', error);
    socket.emit('error', { message: 'Có lỗi xảy ra khi xử lý phản ứng' });
  }
};

export const setup_socket_server = (io: Server, socketStore: { [socket_id: string]: 'waiting' | 'matched' | null }) => {
  // Cập nhật thống kê mỗi 10 giây
  setInterval(() => update_user_stats(io), 10000);
  
  // Tự động ghép đôi người dùng đang chờ mỗi 3 giây
  setInterval(() => match_all_waiting_users(io), 3000);
  
  io.on('connection', (socket: Socket) => {
    // Áp dụng rate limiter trực tiếp trên mỗi socket
    if (socket_rate_limiter(socket)) {
      socket.disconnect();
      return;
    }
    
    logger.info(`Người dùng kết nối: ${socket.id}`);
    
    // Khi người dùng mới kết nối, đưa họ vào hàng đợi
    handle_new_user(socket, io);
    
    // Gửi thống kê ngay khi người dùng kết nối
    update_user_stats(io);
    
    // Xử lý tin nhắn
    socket.on('send-message', async (message_data: { content: string }) => {
      await handle_send_message(socket, io, message_data.content);
    });
    
    // Xử lý phản ứng tin nhắn
    socket.on('add-reaction', (data) => {
      handle_add_reaction(socket, io, data);
    });
    
    // Xử lý khi người dùng muốn tìm đối tác mới
    socket.on('find-new-partner', () => {
      logger.info(`Người dùng ${socket.id} yêu cầu tìm đối tác mới`);
      handle_new_user(socket, io);
    });
    
    // Xử lý khi người dùng ngắt kết nối
    socket.on('disconnect', () => {
      handle_user_disconnect(socket, io);
      cleanup_socket_store(socket.id);
      // Cập nhật trạng thái khi người dùng ngắt kết nối
      update_user_state(socket.id, null, io, socketStore);
      
      // Kích hoạt ghép đôi ngay lập tức sau khi một người dùng ngắt kết nối
      match_all_waiting_users(io);
    });
  });
}; 