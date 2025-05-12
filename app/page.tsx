'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { quotes, Quote } from './data/quotes';
import { FaGithub } from 'react-icons/fa';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTimers, createTimer, updateTimer, deleteAllTimers, Timer } from './lib/api';
import { useTimers, WatchRecord } from './hooks/useTimers';

interface EditingRecord extends Omit<WatchRecord, 'time'> {
  time: string;
}

interface MonthStats {
  month: string;
  year: number;
  totalSeconds: number;
}

// Add loading state interface
interface LoadingState {
  initial: boolean;
  refresh: boolean;
}

interface DataCache {
  timestamp: number;
  data: WatchRecord[];
}

interface NewDayData {
  date: string;
  time: string;
}

const encryptKey = (key: string): string => {
  const salt = 'work_timer_salt_2024'; // A constant salt for the encryption
  let result = '';
  for (let i = 0; i < key.length; i++) {
    // XOR each character with the salt character and convert to hex
    const charCode = key.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
    result += charCode.toString(16).padStart(2, '0');
  }
  return result;
};

const decryptKey = (encryptedKey: string): string => {
  const salt = 'work_timer_salt_2024';
  let result = '';
  for (let i = 0; i < encryptedKey.length; i += 2) {
    // Convert hex back to number and XOR with salt
    const charCode = parseInt(encryptedKey.substr(i, 2), 16) ^ salt.charCodeAt((i/2) % salt.length);
    result += String.fromCharCode(charCode);
  }
  return result;
};

const Home = (): React.JSX.Element => {
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [watchHistory, setWatchHistory] = useState<WatchRecord[]>([]);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [monthStats, setMonthStats] = useState<MonthStats[]>([]);
  const [currentQuote, setCurrentQuote] = useState<Quote>({ content: '', author: '' });
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(true);
  const [editingRecord, setEditingRecord] = useState<EditingRecord | null>(null);
  const [showAddDay, setShowAddDay] = useState<boolean>(false);
  const [newDayData, setNewDayData] = useState<NewDayData>({
    date: '',
    time: '',
  });
  const [countdown, setCountdown] = useState<number>(10);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);
  const [secretKey, setSecretKey] = useState<string>('');
  const [showSecretSetup, setShowSecretSetup] = useState<boolean>(false);
  const [confirmSecretKey, setConfirmSecretKey] = useState<string>('');
  
  // Add loading states
  const [loading, setLoading] = useState<LoadingState>({
    initial: true,
    refresh: false
  });

  // Add cache state
  const [dataCache, setDataCache] = useState<DataCache | null>(null);

  const queryClient = useQueryClient();
  
  // Replace the React Query usage with useTimers hook
  const { 
    timers, 
    isLoading, 
    isError,
    createOrUpdateTimer 
  } = useTimers();

  // Create timer mutation
  const createTimerMutation = useMutation({
    mutationFn: createTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      toast.success('Timer saved successfully!', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #22C55E',
        },
        iconTheme: {
          primary: '#22C55E',
          secondary: '#fff',
        },
      });
    },
    onError: (error) => {
      console.error('Error saving timer:', error);
      toast.error('Failed to save timer', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #F97316',
        },
        iconTheme: {
          primary: '#F97316',
          secondary: '#fff',
        },
      });
    }
  });

  // Update timer mutation
  const updateTimerMutation = useMutation({
    mutationFn: updateTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      toast.success('Timer updated successfully!', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #22C55E',
        },
        iconTheme: {
          primary: '#22C55E',
          secondary: '#fff',
        },
      });
    },
    onError: (error) => {
      console.error('Error updating timer:', error);
      toast.error('Failed to update timer', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #F97316',
        },
        iconTheme: {
          primary: '#F97316',
          secondary: '#fff',
        },
      });
    }
  });

  // Delete all timers mutation
  const deleteAllTimersMutation = useMutation({
    mutationFn: deleteAllTimers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      toast.success('All data has been cleared!', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #22C55E',
        },
        iconTheme: {
          primary: '#22C55E',
          secondary: '#fff',
        },
      });
      setShowConfirm(false);
      setIsCountdownActive(false);
      setCountdown(10);
      setConfirmSecretKey('');
    },
    onError: (error) => {
      console.error('Error deleting timers:', error);
      toast.error('Failed to delete timers', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #F97316',
        },
        iconTheme: {
          primary: '#F97316',
          secondary: '#fff',
        },
      });
    }
  });

  // Function to check if cache is valid (less than 30 seconds old)
  const isCacheValid = () => {
    if (!dataCache) return false;
    const now = Date.now();
    return (now - dataCache.timestamp) < 30000; // 30 seconds
  };

  // Get random quote
  useEffect(() => {
    const getRandomQuote = () => {
      setIsLoadingQuote(true);
      try {
        const randomIndex = Math.floor(Math.random() * quotes.length);
        setCurrentQuote(quotes[randomIndex]);
      } catch (error) {
        console.error('Error getting quote:', error);
        setCurrentQuote({
          content: "The only way to do great work is to love what you do.",
          author: "Steve Jobs"
        });
      } finally {
        setIsLoadingQuote(false);
      }
    };

    getRandomQuote();
  }, []);

  // Format date to readable format (e.g., "5th May, 2025")
  const formatReadableDate = (dateStr: string): string => {
    try {
      if (!dateStr) {
        console.error('Invalid date string:', dateStr);
        return 'Invalid Date';
      }

      const parts = dateStr.split(':');
      if (parts.length !== 3) {
        console.error('Invalid date format:', dateStr);
        return 'Invalid Date';
      }

      const [dayStr, monthStr, yearStr] = parts;
      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10);

      if (isNaN(day) || isNaN(month) || isNaN(year)) {
        console.error('Invalid date numbers:', { day, month, year });
        return 'Invalid Date';
      }

      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) {
        console.error('Invalid date object:', date);
        return 'Invalid Date';
      }
      
      // Get day with ordinal suffix
      const getOrdinalSuffix = (n: number): string => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      
      const dayWithSuffix = getOrdinalSuffix(date.getDate());
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      return `${dayWithSuffix} ${monthName}, ${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Format date to DD:MM:YYYY for storage
  const formatDateForStorage = (date: Date): string => {
    try {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        console.error('Invalid date object:', date);
        return '';
      }

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}:${month}:${year}`;
    } catch (error) {
      console.error('Error formatting date for storage:', error);
      return '';
    }
  };

  // Calculate monthly statistics
  const calculateMonthStats = (history: WatchRecord[]) => {
    try {
      const stats: { [key: string]: number } = {};
      
      history.forEach(record => {
        if (!record.date) {
          console.error('Invalid record date:', record);
          return;
        }

        try {
          // Parse the date string properly (DD:MM:YYYY)
          const parts = record.date.split(':');
          if (parts.length !== 3) {
            console.error('Invalid date format:', record.date);
            return;
          }

          const [dayStr, monthStr, yearStr] = parts;
          const day = parseInt(dayStr, 10);
          const month = parseInt(monthStr, 10);
          const year = parseInt(yearStr, 10);

          if (isNaN(day) || isNaN(month) || isNaN(year)) {
            console.error('Invalid date numbers:', { day, month, year });
            return;
          }

          const date = new Date(year, month - 1, day);
          if (isNaN(date.getTime())) {
            console.error('Invalid date object:', date);
            return;
          }

          const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
          stats[monthYear] = (stats[monthYear] || 0) + (record.time || 0);
        } catch (error) {
          console.error('Error processing record:', error, record);
        }
      });

      const monthStatsArray = Object.entries(stats).map(([monthYear, totalSeconds]) => {
        const [month, yearStr] = monthYear.split(' ');
        return {
          month,
          year: parseInt(yearStr, 10),
          totalSeconds: totalSeconds
        };
      });

      // Sort by year and month
      monthStatsArray.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return months.indexOf(b.month) - months.indexOf(a.month);
      });

      setMonthStats(monthStatsArray);
    } catch (error) {
      console.error('Error calculating month stats:', error);
      setMonthStats([]);
    }
  };

  // Load data from MongoDB on component mount and refresh
  useEffect(() => {
    const loadTimers = async () => {
      try {
        // If this is a refresh (not initial load) and cache is valid, use cached data
        if (!loading.initial && isCacheValid()) {
          setWatchHistory(dataCache!.data);
          calculateMonthStats(dataCache!.data);
          return;
        }

        // Set appropriate loading state
        setLoading(prev => ({
          ...prev,
          [loading.initial ? 'initial' : 'refresh']: true
        }));

        const response = await fetch('/api/timers', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch timers from database');
        }

        const timers = await response.json();

        // Convert to WatchRecord format with sequential displayId
        const records: WatchRecord[] = timers
          .filter((timer: any) => timer && timer._id && timer.date)
          .map((timer: any) => ({
            id: timer._id,
            displayId: 0,
            date: timer.date,
            dayOfWeek: timer.dayOfWeek || new Date(timer.date.split(':').reverse().join('-')).toLocaleDateString('en-US', { weekday: 'long' }),
            time: timer.duration || 0
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

        // Update cache
        setDataCache({
          timestamp: Date.now(),
          data: records
        });

        // Update state with minimal UI disruption
        setWatchHistory(prev => {
          // Only update if data has actually changed
          if (JSON.stringify(prev) !== JSON.stringify(records)) {
            return records;
          }
          return prev;
        });
        
        calculateMonthStats(records);

        if (!loading.initial) {
          toast.success('Data refreshed!', {
            style: {
              background: '#1F2937',
              color: '#fff',
              border: '1px solid #22C55E',
            },
            iconTheme: {
              primary: '#22C55E',
              secondary: '#fff',
            },
          });
        }
      } catch (error) {
        console.error('Error loading timers:', error);
        toast.error('Failed to load data from database', {
          style: {
            background: '#1F2937',
            color: '#fff',
            border: '1px solid #EF4444',
          },
          iconTheme: {
            primary: '#EF4444',
            secondary: '#fff',
          },
        });
      } finally {
        // Clear loading state
        setLoading(prev => ({
          ...prev,
          initial: false,
          refresh: false
        }));
      }
    };

    // Load data immediately on mount
    loadTimers();

    // Set up interval to refresh data every 30 seconds
    const intervalId = setInterval(loadTimers, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array since we want this to run only on mount

  // Load secret key from localStorage on component mount
  useEffect(() => {
    const savedSecretKey = localStorage.getItem('secretKey');
    if (savedSecretKey) {
      try {
        // Decrypt the key when loading
        const decryptedKey = decryptKey(savedSecretKey);
        setSecretKey(decryptedKey);
      } catch (error) {
        console.error('Error decrypting secret key:', error);
        // If decryption fails, clear the invalid key
        localStorage.removeItem('secretKey');
        setShowSecretSetup(true);
      }
    } else {
      setShowSecretSetup(true);
    }
  }, []);

  // Update month stats when watch history changes
  useEffect(() => {
    if (watchHistory.length > 0) {
      calculateMonthStats(watchHistory);
    }
  }, [watchHistory]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let startTime: number;
    let elapsedTime: number = time;

    if (isRunning && !isDone) {
      startTime = Date.now() - (elapsedTime * 1000);
      
      intervalId = setInterval(() => {
        const currentTime = Date.now();
        const newElapsedTime = Math.floor((currentTime - startTime) / 1000);
        setTime(newElapsedTime);
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, isDone]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let timeString = '';

    if (hours > 0) {
      timeString += `${hours} hour${hours > 1 ? 's' : ''}`;
      if (minutes > 0) {
        timeString += ` and ${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
    } else if (minutes > 0) {
      timeString += `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      timeString += `${secs} second${secs > 1 ? 's' : ''}`;
    }

    return timeString;
  };

  const formatTimeInterval = (seconds: number): string => {
    if (isNaN(seconds) || seconds === undefined) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      if (minutes > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const handleStart = () => {
    setIsRunning(true);
    setIsDone(false);
    // Only reset time if it's a new session (time is 0)
    if (time === 0) {
      setTime(0);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
    // Don't reset time when pausing
  };

  const handleDone = async () => {
    if (time > 0) {
      setIsRunning(false);
      setIsDone(true);
      
      const now = new Date();
      const formattedDate = formatDateForStorage(now);
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

      try {
        await createOrUpdateTimer({
          title: `Work Session - ${formattedDate}`,
          duration: time,
          date: formattedDate,
          dayOfWeek: dayOfWeek
        });

        setTime(0);
        setTimeout(() => {
          setIsDone(false);
        }, 1000);
      } catch (error) {
        console.error('Error in handleDone:', error);
      }
    }
  };

  // Add countdown effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCountdownActive && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setIsCountdownActive(false);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCountdownActive, countdown]);

  const handleSetupSecretKey = () => {
    if (!secretKey.trim()) {
      toast.error('Please enter a secret key', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #F97316',
        },
        iconTheme: {
          primary: '#F97316',
          secondary: '#fff',
        },
      });
      return;
    }

    if (secretKey !== confirmSecretKey) {
      toast.error('Secret keys do not match', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #F97316',
        },
        iconTheme: {
          primary: '#F97316',
          secondary: '#fff',
        },
      });
      return;
    }

    // Encrypt the key before storing
    const encryptedKey = encryptKey(secretKey);
    localStorage.setItem('secretKey', encryptedKey);
    setShowSecretSetup(false);
    toast.success('Secret key setup complete!', {
      style: {
        background: '#1F2937',
        color: '#fff',
        border: '1px solid #22C55E',
      },
      iconTheme: {
        primary: '#22C55E',
        secondary: '#fff',
      },
    });
  };

  const handleDestroyData = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      setIsCountdownActive(true);
      setCountdown(10);
      setConfirmSecretKey('');
      return;
    }

    try {
      await deleteAllTimersMutation.mutateAsync();
    } catch (error) {
      console.error('Error in handleDestroyData:', error);
    }
  };

  // Calculate totals from React Query data
  const totalDays = timers ? new Set(timers.map((record: WatchRecord) => record.date)).size : 0;
  const totalTimeInSeconds = timers ? timers.reduce((acc: number, record: WatchRecord) => acc + record.time, 0) : 0;

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Work Timer History', 14, 15);
    
    // Add summary
    doc.setFontSize(12);
    doc.text(`Total Days: ${totalDays}`, 14, 25);
    doc.text(`Total Time: ${formatTime(totalTimeInSeconds)}`, 14, 32);
    
    // Create table
    const tableColumn = ['ID', 'Date', 'Day', 'Time'];
    const tableRows = timers?.map(record => [
      record.displayId,
      formatReadableDate(record.date),
      record.dayOfWeek,
      formatTime(record.time)
    ]) || [];
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [255, 165, 0], // Orange color
        textColor: [0, 0, 0],
      },
    });
    
    // Save the PDF
    doc.save('work-timer-history.pdf');
    
    toast.success('PDF exported successfully!', {
      style: {
        background: '#1F2937',
        color: '#fff',
        border: '1px solid #22C55E',
      },
      iconTheme: {
        primary: '#22C55E',
        secondary: '#fff',
      },
    });
  };

  const handleEdit = async (record: WatchRecord) => {
    // Convert seconds to HH:MM format for editing
    const hours = Math.floor(record.time / 3600);
    const minutes = Math.floor((record.time % 3600) / 60);
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    setEditingRecord({ 
      ...record,
      time: formattedTime
    });
  };

  const handleInputChange = (field: keyof EditingRecord, value: string) => {
    if (!editingRecord) return;
    
    // If it's the time field, ensure proper format
    if (field === 'time') {
      // Only allow numbers and colons
      const sanitizedValue = value.replace(/[^0-9:]/, '');
      // Ensure proper HH:MM format
      if (sanitizedValue.length <= 5) { // Max length for HH:MM
        setEditingRecord(prev => ({ ...prev!, [field]: sanitizedValue }));
      }
    } else {
      setEditingRecord(prev => ({ ...prev!, [field]: value }));
    }
  };

  const handleSaveEdit = async () => {
    if (editingRecord && editingRecord.time) {
      try {
        // Validate date format (DD:MM:YYYY)
        const dateRegex = /^(\d{2}):(\d{2}):(\d{4})$/;
        if (!dateRegex.test(editingRecord.date)) {
          toast.error('Please enter date in DD:MM:YYYY format (e.g., 01:05:2024)', {
            style: {
              background: '#1F2937',
              color: '#fff',
              border: '1px solid #F97316',
            },
            iconTheme: {
              primary: '#F97316',
              secondary: '#fff',
            },
          });
          return;
        }

        // Validate time format (HH:MM)
        const timeRegex = /^(\d{2}):(\d{2})$/;
        if (!timeRegex.test(editingRecord.time)) {
          toast.error('Please enter time in HH:MM format (e.g., 02:30)', {
            style: {
              background: '#1F2937',
              color: '#fff',
              border: '1px solid #F97316',
            },
            iconTheme: {
              primary: '#F97316',
              secondary: '#fff',
            },
          });
          return;
        }

        const [hours, minutes] = editingRecord.time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          toast.error('Please enter a valid time', {
            style: {
              background: '#1F2937',
              color: '#fff',
              border: '1px solid #F97316',
            },
            iconTheme: {
              primary: '#F97316',
              secondary: '#fff',
            },
          });
          return;
        }

        const totalSeconds = (hours * 3600) + (minutes * 60);

        // Make the update request
        await updateTimerMutation.mutateAsync({
          id: editingRecord.id,
          duration: totalSeconds,
          date: editingRecord.date,
          dayOfWeek: editingRecord.dayOfWeek,
          title: `Work Session - ${editingRecord.date}`
        });

        setEditingRecord(null);
        
        toast.success('Timer updated successfully!', {
          style: {
            background: '#1F2937',
            color: '#fff',
            border: '1px solid #22C55E',
          },
          iconTheme: {
            primary: '#22C55E',
            secondary: '#fff',
          },
        });
      } catch (error) {
        console.error('Error saving edit:', error);
        toast.error('Failed to save changes', {
          style: {
            background: '#1F2937',
            color: '#fff',
            border: '1px solid #F97316',
          },
          iconTheme: {
            primary: '#F97316',
            secondary: '#fff',
          },
        });
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
  };

  const handleAddDay = async () => {
    if (!showAddDay) {
      setShowAddDay(true);
      return;
    }

    // Validate time format (HH:MM:SS)
    const timeRegex = /^(\d{2}):(\d{2}):(\d{2})$/;
    if (!timeRegex.test(newDayData.time)) {
      toast.error('Please enter time in HH:MM:SS format', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #F97316',
        },
        iconTheme: {
          primary: '#F97316',
          secondary: '#fff',
        },
      });
      return;
    }

    // Parse the readable date back to storage format
    const dateMatch = newDayData.date.match(/(\d+)(?:st|nd|rd|th) (\w+), (\d{4})/);
    if (!dateMatch) {
      toast.error('Please enter date in correct format (e.g., "5th May, 2025")', {
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #F97316',
        },
        iconTheme: {
          primary: '#F97316',
          secondary: '#fff',
        },
      });
      return;
    }

    const [_, day, monthName, year] = dateMatch;
    const month = new Date(`${monthName} 1, 2000`).getMonth() + 1;
    const formattedDate = `${day.padStart(2, '0')}:${month.toString().padStart(2, '0')}:${year}`;

    // Get day of week from the date
    const dateObj = new Date(parseInt(year), month - 1, parseInt(day));
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    // Convert time string to seconds
    const [hours, minutes, seconds] = newDayData.time.split(':').map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    try {
      await createOrUpdateTimer({
        title: `Work Session - ${formattedDate}`,
        duration: totalSeconds,
        date: formattedDate,
        dayOfWeek: dayOfWeek
      });

      setShowAddDay(false);
      setNewDayData({ date: '', time: '' });
    } catch (error) {
      console.error('Error in handleAddDay:', error);
    }
  };

  // Add Loading Spinner Component
  const LoadingSpinner = ({ size = 'default' }: { size?: 'mini' | 'default' }) => (
    <div className={`flex items-center justify-center ${size === 'mini' ? 'h-6' : 'h-32'}`}>
      <div 
        className={`
          animate-spin rounded-full 
          border-t-2 border-b-2 border-orange-400 
          ${size === 'mini' ? 'h-4 w-4' : 'h-12 w-12'}
        `}
      />
    </div>
  );

  // Modify the table section to include loading states
  const renderTable = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }

    if (isError) {
      return (
        <div className="text-center py-8">
          <p className="text-red-500 text-lg mb-4">Error loading data. Please try again later.</p>
        </div>
      );
    }

    if (!timers || timers.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-400 text-lg mb-4">No data found. Please add data using the timer above.</p>
        </div>
      );
    }

    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
            >
              <span>📊</span> Export Data
            </button>
          </div>
          <div>
            <button
              onClick={handleDestroyData}
              className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm flex items-center gap-1"
            >
              <span>🗑️</span> Destroy All Data
            </button>
          </div>
        </div>

        {/* Confirmation Modal for Data Destruction */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="relative p-[1px] rounded-lg w-full max-w-md">
              {/* Gradient Border */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-400 via-orange-400 to-red-400"></div>
              
              {/* Content Container */}
              <div className="relative bg-gray-800/90 p-6 rounded-lg">
                <h2 className="text-xl font-bold text-red-400 mb-4 text-center">⚠️ Confirm Data Destruction</h2>
                <p className="text-gray-300 mb-4 text-center">
                  This action will permanently delete all your timer data. This cannot be undone.
                </p>
                {isCountdownActive && (
                  <p className="text-orange-400 text-center mb-4">
                    Deleting in {countdown} seconds...
                  </p>
                )}
                <div className="space-y-4">
                  <input
                    type="password"
                    value={confirmSecretKey}
                    onChange={(e) => setConfirmSecretKey(e.target.value)}
                    className="bg-gray-700 text-white px-4 py-2 rounded w-full text-center"
                    placeholder="Enter your secret key to confirm"
                  />
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => {
                        setShowConfirm(false);
                        setIsCountdownActive(false);
                        setCountdown(10);
                        setConfirmSecretKey('');
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDestroyData}
                      disabled={!confirmSecretKey || confirmSecretKey !== secretKey}
                      className={`px-4 py-2 text-white rounded transition-colors ${
                        confirmSecretKey === secretKey ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 cursor-not-allowed'
                      }`}
                    >
                      Confirm Destroy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <h3 className="text-base sm:text-xl mb-3 sm:mb-4 text-center bg-gradient-to-r from-green-400 via-orange-400 to-green-400 bg-clip-text text-transparent font-bold">
          You have worked for {formatTotalTime(totalTimeInSeconds)} in total
        </h3>
        <div className="overflow-x-auto relative">
          {(createTimerMutation.isPending || updateTimerMutation.isPending || deleteAllTimersMutation.isPending) && (
            <div className="absolute top-2 right-2 z-10">
              <LoadingSpinner size="mini" />
            </div>
          )}
          <div className="relative p-[1px] rounded-lg">
            {/* Gradient Border */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-400 via-green-400 to-orange-400"></div>
            
            {/* Blurry Gradient Background */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-500/10 via-green-500/10 to-orange-500/10 backdrop-blur-sm"></div>
            
            {/* Content Container */}
            <div className="relative bg-gray-800/90 rounded-lg overflow-hidden">
              <table className="min-w-full text-sm sm:text-base">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-orange-400 text-center text-xs sm:text-sm">ID</th>
                    <th className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-orange-400 text-center text-xs sm:text-sm">Date</th>
                    <th className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-orange-400 text-center text-xs sm:text-sm">Day</th>
                    <th className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-orange-400 text-center text-xs sm:text-sm">Time</th>
                    <th className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-orange-400 text-center text-xs sm:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {timers.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-700">
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-center text-xs sm:text-sm">
                        {record.displayId}
                      </td>
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-center text-xs sm:text-sm">
                        {editingRecord?.id === record.id ? (
                          <input
                            type="text"
                            value={editingRecord.date}
                            onChange={(e) => handleInputChange('date', e.target.value)}
                            className="bg-gray-700 text-white px-1 sm:px-2 py-0.5 sm:py-1 rounded w-full text-center text-xs sm:text-sm"
                            placeholder="DD:MM:YYYY"
                          />
                        ) : (
                          formatReadableDate(record.date)
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-center text-xs sm:text-sm">
                        {editingRecord?.id === record.id ? (
                          <input
                            type="text"
                            value={editingRecord.dayOfWeek}
                            onChange={(e) => handleInputChange('dayOfWeek', e.target.value)}
                            className="bg-gray-700 text-white px-1 sm:px-2 py-0.5 sm:py-1 rounded w-full text-center text-xs sm:text-sm"
                            placeholder="e.g., Monday"
                          />
                        ) : (
                          record.dayOfWeek
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-center text-xs sm:text-sm">
                        {editingRecord?.id === record.id ? (
                          <input
                            type="text"
                            value={editingRecord.time}
                            onChange={(e) => handleInputChange('time', e.target.value)}
                            className="bg-gray-700 text-white px-1 sm:px-2 py-0.5 sm:py-1 rounded w-full text-center text-xs sm:text-sm"
                            placeholder="HH:MM:SS"
                          />
                        ) : (
                          formatTime(record.time)
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-center text-xs sm:text-sm">
                        {editingRecord?.id === record.id ? (
                          <div className="flex gap-1 sm:gap-2 justify-center">
                            <button
                              onClick={handleSaveEdit}
                              className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs sm:text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(record)}
                            className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-xs sm:text-sm"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-700">
                  <tr>
                    <td colSpan={2} className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-center font-bold text-orange-400 text-xs sm:text-sm">
                      Total Days: {totalDays}
                    </td>
                    <td colSpan={3} className="px-2 sm:px-4 py-1.5 sm:py-2 border border-orange-500/20 text-center font-bold text-orange-400 text-xs sm:text-sm">
                      Total Time: {formatTime(totalTimeInSeconds)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  };

  // Update useEffect for monthStats to use React Query data
  useEffect(() => {
    if (timers && timers.length > 0) {
      calculateMonthStats(timers);
    }
  }, [timers]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1F2937',
            color: '#fff',
          },
        }}
      />
      
      {/* Secret Key Setup Modal */}
      {showSecretSetup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative p-[1px] rounded-lg w-full max-w-[90%] sm:max-w-md">
            {/* Gradient Border */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-400 via-green-400 to-orange-400"></div>
            
            {/* Content Container */}
            <div className="relative bg-gray-800/90 p-4 sm:p-6 rounded-lg">
              <h2 className="text-xl sm:text-2xl font-bold text-orange-400 mb-2 sm:mb-4 text-center">
                Setup Secret Key
              </h2>
              <p className="text-sm sm:text-base text-gray-300 mb-2 sm:mb-4 text-center">
                Setup a easy password, you won't be allowed to reset later.
              </p>
              <p className="text-sm sm:text-base text-orange-400 mb-3 sm:mb-4 text-center italic">
                Suggestion: It can be your computer or phone password.
              </p>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="bg-gray-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded w-full text-center text-sm sm:text-base"
                    placeholder="Enter your secret key"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    value={confirmSecretKey}
                    onChange={(e) => setConfirmSecretKey(e.target.value)}
                    className="bg-gray-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded w-full text-center text-sm sm:text-base"
                    placeholder="Confirm your secret key"
                  />
                </div>
                <button
                  onClick={handleSetupSecretKey}
                  className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-sm sm:text-base"
                >
                  Setup Secret Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="relative">
          {/* Gradient Border */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-green-400 to-orange-400"></div>
          
          {/* Blurry Background */}
          <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-md"></div>
          
          {/* Content */}
          <div className="relative flex items-center justify-center px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl">⌛</span>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 via-green-400 to-orange-400 bg-clip-text text-transparent">
                Work Timer
              </h1>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 mt-20">
        {/* Motivational Quote Section */}
        <div className="w-full max-w-4xl mb-8 text-center">
          <div className="relative p-[1px] rounded-lg">
            {/* Gradient Border */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-400 via-green-400 to-orange-400"></div>
            
            {/* Blurry Gradient Background */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-500/10 via-green-500/10 to-orange-500/10 backdrop-blur-sm"></div>
            
            {/* Content Container */}
            <div className="relative bg-gray-800/90 p-6 rounded-lg">
              {isLoadingQuote ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400"></div>
                </div>
              ) : (
                <>
                  <p className="text-xl text-orange-400 italic mb-2">"{currentQuote.content}"</p>
                  <p className="text-white">- {currentQuote.author}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Month Pins Section */}
        {monthStats.length > 0 && (
          <div className="w-full max-w-4xl mb-8">
            <div className='flex gap-2 items-center justify-center mb-4'>
              <span className='text-3xl'>🔥</span>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-green-400 to-orange-400 bg-clip-text text-transparent">
                Monthly Progress
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthStats.map((stat) => (
                <div
                  key={`${stat.month}-${stat.year}`}
                  className="relative p-[1px] rounded-lg"
                >
                  {/* Gradient Border */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-400 via-green-400 to-orange-400"></div>
                  
                  {/* Blurry Gradient Background */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-500/10 via-green-500/10 to-orange-500/10 backdrop-blur-sm"></div>
                  
                  {/* Content Container */}
                  <div className="relative bg-gray-800/90 p-4 rounded-lg">
                    <h3 className="text-xl font-bold text-orange-400">{stat.month} {stat.year}</h3>
                    <p className="text-gray-300 mt-2">
                      Total Time: <span className="text-green-400 font-semibold">{formatTimeInterval(stat.totalSeconds)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* main container */}
        <div className="relative p-[1px] rounded-lg w-full max-w-4xl">
          {/* Gradient Border */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-400 via-green-400 to-orange-400"></div>
          
          {/* Content Container */}
          <div className="relative bg-gray-800/100 p-8 rounded-lg">
            <div className="text-4xl font-bold text-center mb-6 text-orange-400">
              {formatTime(time)}
            </div>
            <div className="flex gap-4 justify-center mb-8">
              {!isRunning && !isDone && (
                <button
                  onClick={handleStart}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                >
                  Start
                </button>
              )}
              {isRunning && (
                <button
                  onClick={handlePause}
                  className="px-4 py-2 bg-orange-400 text-gray-900 rounded hover:bg-orange-300 transition-colors"
                >
                  Pause
                </button>
              )}
              {time > 0 && !isDone && (
                <button
                  onClick={handleDone}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Done
                </button>
              )}
            </div>

            {/* History Table */}
            <div className="mt-8">
              <div className="flex flex-col items-center mb-4">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-green-400 to-orange-400 bg-clip-text text-transparent mb-2">
                  Work History
                </h2>
                {/* Gradient Border */}
                <div className="w-full h-[1px] bg-gradient-to-r from-orange-400 via-green-400 to-orange-400"></div>
              </div>
              {renderTable()}
            </div>
          </div>
        </div>
        <footer className="mt-8 text-center">
          <a 
            href="https://github.com/devkoushiik" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block mb-4 hover:scale-110 transition-transform"
          >
            <FaGithub className="text-4xl text-gray-400 hover:text-orange-400" />
          </a>
          <p className="text-gray-400 text-sm">
            Developed by <span className="text-orange-400 font-semibold">Koushik Ahmed</span>
          </p>
        </footer>

        {/* Add this to your global CSS or style tag */}
        <style jsx global>{`
          @keyframes gradient-x {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-gradient-x {
            background-size: 200% 200%;
            animation: gradient-x 15s ease infinite;
          }
        `}</style>
      </div>
    </div>
  );
};

export default Home;