import { Router } from 'express';

const router = Router();

// Health check
router.get('/status', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

export default router; 