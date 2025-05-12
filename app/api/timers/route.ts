import { NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import Timer from '@/app/models/Timer';

export async function GET() {
  try {
    await connectDB();
    const timers = await Timer.find({}).sort({ createdAt: -1 });
    return NextResponse.json(timers);
  } catch (error: any) {
    console.error('GET /api/timers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timers', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await connectDB();
    const timer = await Timer.create({
      ...body,
      updatedAt: new Date()
    });
    return NextResponse.json(timer, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/timers error:', error);
    return NextResponse.json(
      { error: 'Failed to create timer', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    
    await connectDB();
    const timer = await Timer.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
    
    if (!timer) {
      return NextResponse.json(
        { error: 'Timer not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(timer);
  } catch (error: any) {
    console.error('PUT /api/timers error:', error);
    return NextResponse.json(
      { error: 'Failed to update timer', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Timer ID is required' },
        { status: 400 }
      );
    }
    
    await connectDB();
    const timer = await Timer.findByIdAndDelete(id);
    
    if (!timer) {
      return NextResponse.json(
        { error: 'Timer not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Timer deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/timers error:', error);
    return NextResponse.json(
      { error: 'Failed to delete timer', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 