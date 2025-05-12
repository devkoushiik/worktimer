import { NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import User from '@/app/models/User';

// Get user (we'll only have one user for this app)
export async function GET() {
  try {
    await connectDB();
    const user = await User.findOne({});
    
    // Instead of returning an error, return a success response with null data
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('GET /api/user error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// Create or update user
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secretKey } = body;

    if (!secretKey) {
      return NextResponse.json(
        { error: 'Secret key is required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find existing user or create new one
    const user = await User.findOne({});
    if (user) {
      // Update existing user
      user.secretKey = secretKey;
      user.updatedAt = new Date();
      await user.save();
    } else {
      // Create new user
      await User.create({
        secretKey,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return NextResponse.json({ message: 'Secret key saved successfully' });
  } catch (error: any) {
    console.error('POST /api/user error:', error);
    return NextResponse.json(
      { error: 'Failed to save secret key', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 