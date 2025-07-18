import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// API route kiểm tra trạng thái server
router.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    message: 'Server đang hoạt động bình thường'
  });
});

// API route lấy thông tin người dùng hiện tại
router.get('/stats', (req: Request, res: Response) => {
  const io = req.app.get('io');
  
  if (!io) {
    logger.error('Socket.IO server chưa được khởi tạo');
    return res.status(500).json({ error: 'Lỗi nội bộ server' });
  }

  // Lấy số lượng người dùng từ io
  const online_users = Object.keys(io.sockets.sockets).length || 0;
  
  // Lấy số người dùng đang chờ từ socket store
  const socketStore: any = req.app.get('socketStore') || {};
  const waiting_users = Object.values(socketStore).filter((state: any) => state === 'waiting').length || 0;
  
  res.json({
    online_users,
    waiting_users,
    timestamp: new Date()
  });
});

export default router; 