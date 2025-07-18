import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  participants: string[]; // Mảng chứa socketId của người tham gia
  is_active: boolean;
  last_activity: Date; // Thời gian hoạt động cuối cùng
  created_at: Date;
  updated_at: Date;
}

const ConversationSchema: Schema = new Schema(
  {
    participants: {
      type: [String],
      required: true,
      validate: {
        validator: function(v: string[]) {
          return v.length === 2; // Đảm bảo chỉ có 2 người dùng trong mỗi cuộc trò chuyện
        },
        message: 'Conversation phải có đúng 2 người tham gia'
      }
    },
    is_active: {
      type: Boolean,
      default: true
    },
    last_activity: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: { 
      createdAt: 'created_at'
    }
  }
);

export default mongoose.model<IConversation>('conversation', ConversationSchema);
