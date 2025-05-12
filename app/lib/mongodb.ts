import mongoose from 'mongoose';

interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: Cached | undefined;
}

if (!process.env.MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!global.mongooseCache) {
  global.mongooseCache = {
    conn: null,
    promise: null
  }
}

async function connectDB() {
  try {
    const cached = global.mongooseCache;

    if (cached?.conn) {
      console.log('✅ Using existing MongoDB connection');
      return cached.conn;
    }

    console.log('🔄 Connecting to MongoDB...');
    console.log(`🌐 Attempting to connect to: ${MONGODB_URI.replace(/:[^:]*@/, ':****@')}`);
    
    const opts = {
      bufferCommands: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    const mongooseInstance = await mongoose.connect(MONGODB_URI, opts);
    
    if (!cached) {
      global.mongooseCache = {
        conn: mongooseInstance,
        promise: null
      };
    } else {
      cached.conn = mongooseInstance;
    }

    console.log('✅ MongoDB Connected Successfully!');
    
    const dbName = mongooseInstance.connection.db?.databaseName || 'unknown';
    const host = mongooseInstance.connection.host || 'unknown';
    
    console.log(`🗄️  Connected to database: ${dbName}`);
    console.log(`🌐 MongoDB Host: ${host}`);

    return mongooseInstance;
  } catch (error: any) {
    if (global.mongooseCache) {
      global.mongooseCache.promise = null;
    }
    console.error('❌ MongoDB Connection Error:', error.message);
    console.error('🔍 Error Details:', {
      code: error.code,
      name: error.name,
      message: error.message
    });
    throw error;
  }
}

// Listen for connection events
mongoose.connection.on('connected', () => {
  console.log('🟢 MongoDB connection established');
});

mongoose.connection.on('disconnected', () => {
  console.log('🔴 MongoDB connection disconnected');
  if (global.mongooseCache) {
    global.mongooseCache.conn = null;
    global.mongooseCache.promise = null;
  }
});

mongoose.connection.on('error', (err) => {
  console.error('🚨 MongoDB connection error:', err);
  if (global.mongooseCache) {
    global.mongooseCache.conn = null;
    global.mongooseCache.promise = null;
  }
});

export default connectDB; 