import { Socket, Server } from 'socket.io';
import { create_conversation } from '../conversation';
import { logger } from '../../utils/logger';
import { IConversation } from '../../models/conversation';
import { update_user_state } from './setup_socket_server';

// Hàng đợi chứa socket của những người dùng đang chờ ghép đôi
export let waiting_queue: Socket[] = [];

// Hàm ghép đôi hai người dùng
export const match_users = async (socket1: Socket, socket2: Socket, io: Server) => {
  try {
    logger.info(`Ghép đôi người dùng ${socket1.id} với ${socket2.id}`);
    
    // Tạo cuộc trò chuyện mới
    const conversation = await create_conversation([socket1.id, socket2.id]) as IConversation;
    logger.debug(`Đã tạo cuộc trò chuyện mới với ID ${conversation._id}`);
    
    // Thông báo cho cả hai người dùng về việc họ đã được ghép đôi
    socket1.emit('matched', {
      conversation_id: conversation._id,
      partner_id: socket2.id
    });
    
    socket2.emit('matched', {
      conversation_id: conversation._id,
      partner_id: socket1.id
    });
    
    // Thêm cả hai socket vào cùng một phòng
    socket1.join(conversation._id.toString());
    socket2.join(conversation._id.toString());
    
    // Lấy socketStore từ io.sockets.adapter
    const req = socket1.request as any;
    const socketStore = req.app?.get('socketStore') || {};
    
    // Cập nhật trạng thái người dùng
    update_user_state(socket1.id, 'matched', io, socketStore);
    update_user_state(socket2.id, 'matched', io, socketStore);
    
    // In thông tin về các phòng
    logger.debug(`Socket ${socket1.id} đã tham gia vào phòng ${conversation._id.toString()}`);
    logger.debug(`Socket ${socket2.id} đã tham gia vào phòng ${conversation._id.toString()}`);
    
    return true;
  } catch (error) {
    logger.error('Lỗi khi ghép đôi người dùng:', error);
    socket1.emit('error', { message: 'Có lỗi xảy ra khi ghép đôi' });
    socket2.emit('error', { message: 'Có lỗi xảy ra khi ghép đôi' });
    return false;
  }
};

// Hàm để ghép đôi tất cả người dùng đang chờ
export const match_all_waiting_users = async (io: Server) => {
  try {
    logger.debug(`Bắt đầu ghép đôi tất cả người dùng. Hàng đợi hiện có ${waiting_queue.length} người.`);
    
    // Lọc các socket không còn kết nối
    const valid_users = waiting_queue.filter(socket => io.sockets.sockets.has(socket.id));
    waiting_queue = valid_users;
    
    // Ghép đôi từng cặp người dùng
    const matched_users = new Set<string>();
    
    for (let i = 0; i < waiting_queue.length; i++) {
      // Bỏ qua nếu người dùng này đã được ghép đôi
      if (matched_users.has(waiting_queue[i].id)) continue;
      
      // Tìm người dùng tiếp theo chưa được ghép đôi
      for (let j = i + 1; j < waiting_queue.length; j++) {
        if (matched_users.has(waiting_queue[j].id)) continue;
        
        // Ghép đôi hai người dùng
        const match_success = await match_users(waiting_queue[i], waiting_queue[j], io);
        
        if (match_success) {
          matched_users.add(waiting_queue[i].id);
          matched_users.add(waiting_queue[j].id);
          break;
        }
      }
    }
    
    // Cập nhật lại hàng đợi, loại bỏ những người đã được ghép đôi
    waiting_queue = waiting_queue.filter(socket => !matched_users.has(socket.id));
    
    logger.debug(`Đã ghép đôi ${matched_users.size / 2} cặp. Còn lại ${waiting_queue.length} người đang chờ.`);
  } catch (error) {
    logger.error('Lỗi khi ghép đôi tất cả người dùng:', error);
  }
};

export const handle_new_user = async (socket: Socket, io: Server) => {
  try {
    logger.debug(`Hàng đợi hiện tại có ${waiting_queue.length} người dùng`);
    
    // Kiểm tra xem socket này đã nằm trong hàng đợi chưa
    const existingIndex = waiting_queue.findIndex(s => s.id === socket.id);
    if (existingIndex >= 0) {
      logger.debug(`Socket ${socket.id} đã tồn tại trong hàng đợi, không thêm vào nữa`);
      return;
    }
    
    // Xử lý ghép đôi ngay lập tức nếu có người đang chờ
    if (waiting_queue.length > 0) {
      // Tìm người dùng đầu tiên trong hàng đợi còn kết nối
      for (let i = 0; i < waiting_queue.length; i++) {
        const pair_socket = waiting_queue[i];
        
        // Kiểm tra nếu socket này còn kết nối
        if (io.sockets.sockets.has(pair_socket.id)) {
          // Xóa người dùng này khỏi hàng đợi
          waiting_queue.splice(i, 1);
          
          // Ghép đôi hai người dùng
          await match_users(socket, pair_socket, io);
          return;
        }
      }
      
      // Nếu không tìm thấy người dùng nào phù hợp, lọc lại danh sách và thêm người mới
      waiting_queue = waiting_queue.filter(s => io.sockets.sockets.has(s.id));
    }
    
    // Thêm người dùng mới vào hàng đợi
    waiting_queue.push(socket);
    socket.emit('waiting');
    
    // Lấy socketStore từ socket request
    const req = socket.request as any;
    const socketStore = req.app?.get('socketStore') || {};
    
    // Cập nhật trạng thái người dùng
    update_user_state(socket.id, 'waiting', io, socketStore);
    logger.info(`Người dùng ${socket.id} được đưa vào hàng đợi (có ${waiting_queue.length} người trong hàng đợi)`);
    
    // Ghép đôi tất cả người dùng đang chờ
    await match_all_waiting_users(io);
  } catch (error) {
    logger.error('Lỗi khi ghép đôi người dùng:', error);
    socket.emit('error', { message: 'Có lỗi xảy ra khi ghép đôi' });
  }
}; 