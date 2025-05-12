// API functions for timer operations
export interface Timer {
  _id: string;
  title: string;
  duration: number;
  date: string;
  dayOfWeek: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimerInput {
  title: string;
  duration: number;
  date: string;
  dayOfWeek: string;
  completed: boolean;
}

export interface UpdateTimerInput {
  id: string;
  duration: number;
  date: string;
  dayOfWeek: string;
  title?: string;
}

// User related interfaces and functions
export interface User {
  _id: string;
  secretKey: string;
  createdAt: string;
  updatedAt: string;
}

// Fetch all timers
export const fetchTimers = async (): Promise<Timer[]> => {
  const response = await fetch('/api/timers', {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch timers');
  }

  return response.json();
};

// Create a new timer
export const createTimer = async (data: CreateTimerInput): Promise<Timer> => {
  const response = await fetch('/api/timers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create timer');
  }

  return response.json();
};

// Update an existing timer
export const updateTimer = async (data: UpdateTimerInput): Promise<Timer> => {
  const response = await fetch('/api/timers', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update timer');
  }

  return response.json();
};

// Delete all timers
export const deleteAllTimers = async (secretKey: string): Promise<void> => {
  const response = await fetch(`/api/timers?secretKey=${secretKey}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete timers');
  }
};

// Delete a single timer
export const deleteTimer = async (id: string): Promise<void> => {
  const response = await fetch(`/api/timers?id=${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete timer');
  }
};

// Get user
export const getUser = async (): Promise<User | null> => {
  const response = await fetch('/api/user', {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }

  const data = await response.json();
  return data.user;
};

// Save secret key
export const saveSecretKey = async (secretKey: string): Promise<void> => {
  const response = await fetch('/api/user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ secretKey }),
  });

  if (!response.ok) {
    throw new Error('Failed to save secret key');
  }
}; 