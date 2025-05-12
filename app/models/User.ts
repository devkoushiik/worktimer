import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  secretKey: {
    type: String,
    required: [true, 'Please provide a secret key'],
    minlength: [4, 'Secret key must be at least 4 characters long']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.User || mongoose.model('User', UserSchema); 