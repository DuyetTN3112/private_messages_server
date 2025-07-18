import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import { Server } from 'socket.io';
import { setup_socket_server } from './controllers/socket';
import routes from './routes';
import { error_handler } from './middleware/error_handler';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { setup_conversation_monitor } from './utils/conversation_monitor';

// Cấu hình dotenv
dotenv.config();

// Cấu hình MongoDB
mongoose.set('strictQuery', false);

// Tạo Express app
const app = express();

// Middleware và cấu hình
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Định tuyến API
app.use('/api', routes);

// Xử lý lỗi chung
app.use(error_handler);

// Tạo HTTP server
const server = http.createServer(app);

// Khởi tạo Socket.IO server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket store để lưu trữ trạng thái người dùng
const socketStore: { [socket_id: string]: 'waiting' | 'matched' | null } = {};

// Gắn socketStore vào app để có thể truy cập từ các route
app.set('socketStore', socketStore);
// Gắn io vào app
app.set('io', io);

// Cấu hình để socket request có thể truy cập Express app
io.use((socket: any, next) => {
  (socket.request as any).app = app;
  next();
});

// Cấu hình Socket.io
setup_socket_server(io, socketStore);

// Khởi động monitor cho các cuộc trò chuyện không hoạt động
setup_conversation_monitor(io);

// Kết nối MongoDB và khởi động server
const SERVER_PORT = process.env.SERVER_PORT;
const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
  logger.error('MONGODB_URL không được định nghĩa trong file .env');
  process.exit(1);
}

mongoose.connect(MONGODB_URL)
  .then(() => {
    logger.info('Đã kết nối với MongoDB');
    server.listen(SERVER_PORT, () => {
      logger.info(`Server đang chạy trên cổng ${SERVER_PORT}`);
    });
  })
  .catch(error => {
    logger.error('Không thể kết nối với MongoDB:', error);
  });

// Export cho testing
export { app, server }; 