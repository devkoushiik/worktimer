import mongoose from 'mongoose';

const TimerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title for the timer'],
    maxlength: [60, 'Title cannot be more than 60 characters']
  },
  duration: {
    type: Number,
    required: [true, 'Please provide the duration'],
    min: [0, 'Duration cannot be negative']
  },
  date: {
    type: String,
    required: [true, 'Please provide the date']
  },
  dayOfWeek: {
    type: String,
    required: [true, 'Please provide the day of week']
  },
  completed: {
    type: Boolean,
    default: false
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

export default mongoose.models.Timer || mongoose.model('Timer', TimerSchema); 