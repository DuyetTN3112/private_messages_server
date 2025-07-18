import mongoose, { Schema, Document } from 'mongoose';
import { IConversation } from './conversation';

export interface IMessage extends Document {
  conversation_id: IConversation['_id'];
  sender: string; // socketId của người gửi
  content: string;
  created_at: Date;
  updated_at: Date;
}

const MessageSchema: Schema = new Schema(
  {
    conversation_id: {
      type: Schema.Types.ObjectId,
      ref: 'conversation',
      required: true
    },
    sender: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    }
  },
  {
    timestamps: { 
      createdAt: 'created_at'
    }
  }
);

// Tạo index để tìm kiếm tin nhắn theo cuộc hội thoại được tối ưu
MessageSchema.index({ conversation_id: 1, created_at: 1 });

export default mongoose.model<IMessage>('message', MessageSchema);
