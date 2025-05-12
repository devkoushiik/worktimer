import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTimers, createTimer, updateTimer, deleteAllTimers, Timer, CreateTimerInput, UpdateTimerInput } from '../lib/api';

export interface WatchRecord {
  id: string;
  displayId: number;
  date: string;
  dayOfWeek: string;
  time: number;
}

// Convert API data to WatchRecord format
const convertToWatchRecord = (timers: Timer[]): WatchRecord[] => {
  const records = timers
    .filter(timer => timer && timer._id && timer.date)
    .map(timer => ({
      id: timer._id,
      displayId: 0,
      date: timer.date,
      dayOfWeek: timer.dayOfWeek,
      time: timer.duration
    }));

  // Sort records by date (newest first)
  records.sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split(':').map(Number);
    const [dayB, monthB, yearB] = b.date.split(':').map(Number);
    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);
    return dateB.getTime() - dateA.getTime();
  });

  // Update displayIds after sorting
  records.forEach((record, index) => {
    record.displayId = index + 1;
  });

  return records;
};

export function useTimers() {
  const queryClient = useQueryClient();
  const queryKey = ['timers'];

  // Query for fetching timers
  const query = useQuery({
    queryKey,
    queryFn: fetchTimers,
    select: convertToWatchRecord,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Create timer mutation
  const createMutation = useMutation({
    mutationFn: createTimer,
    onMutate: async (newTimer: CreateTimerInput) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousTimers = queryClient.getQueryData<Timer[]>(queryKey);

      // Optimistically update the cache
      if (previousTimers) {
        const optimisticTimer: Timer = {
          _id: 'temp-id-' + Date.now(),
          ...newTimer,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<Timer[]>(queryKey, [...previousTimers, optimisticTimer]);
      }

      return { previousTimers };
    },
    onError: (err, newTimer, context) => {
      // Rollback on error
      if (context?.previousTimers) {
        queryClient.setQueryData(queryKey, context.previousTimers);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Update timer mutation
  const updateMutation = useMutation({
    mutationFn: updateTimer,
    onMutate: async (updatedTimer: UpdateTimerInput) => {
      await queryClient.cancelQueries({ queryKey });
      const previousTimers = queryClient.getQueryData<Timer[]>(queryKey);

      if (previousTimers) {
        const optimisticUpdate = previousTimers.map(timer => 
          timer._id === updatedTimer.id
            ? { 
                ...timer, 
                duration: updatedTimer.duration,
                date: updatedTimer.date,
                dayOfWeek: updatedTimer.dayOfWeek,
                title: updatedTimer.title || timer.title,
                updatedAt: new Date().toISOString()
              }
            : timer
        );
        queryClient.setQueryData(queryKey, optimisticUpdate);
      }

      return { previousTimers };
    },
    onError: (err, updatedTimer, context) => {
      if (context?.previousTimers) {
        queryClient.setQueryData(queryKey, context.previousTimers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete all timers mutation
  const deleteAllMutation = useMutation({
    mutationFn: deleteAllTimers,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previousTimers = queryClient.getQueryData<Timer[]>(queryKey);
      queryClient.setQueryData(queryKey, []);
      return { previousTimers };
    },
    onError: (err, variables, context) => {
      if (context?.previousTimers) {
        queryClient.setQueryData(queryKey, context.previousTimers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // New function to handle creating or updating a timer
  const createOrUpdateTimer = async (data: {
    title: string;
    duration: number;
    date: string;
    dayOfWeek: string;
    completed?: boolean;
  }) => {
    const existingTimer = query.data?.find(record => record.date === data.date);

    if (existingTimer) {
      // Update existing timer
      return updateMutation.mutateAsync({
        id: existingTimer.id,
        duration: existingTimer.time + data.duration,
        date: data.date,
        dayOfWeek: data.dayOfWeek,
        title: data.title
      });
    } else {
      // Create new timer
      return createMutation.mutateAsync({
        title: data.title,
        duration: data.duration,
        completed: data.completed ?? true,
        date: data.date,
        dayOfWeek: data.dayOfWeek
      });
    }
  };

  // Prefetch function for specific timer data
  const prefetchTimer = async (date: string) => {
    const timers = queryClient.getQueryData<Timer[]>(queryKey);
    if (timers) {
      const existingTimer = timers.find(timer => timer.date === date);
      if (existingTimer) {
        // If we have the timer in cache, warm it
        queryClient.setQueryData(
          ['timer', existingTimer._id],
          existingTimer
        );
      }
    }
  };

  return {
    timers: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createTimer: createMutation.mutateAsync,
    updateTimer: updateMutation.mutateAsync,
    deleteAllTimers: deleteAllMutation.mutateAsync,
    createOrUpdateTimer,
    prefetchTimer,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteAllMutation.isPending,
  };
} 