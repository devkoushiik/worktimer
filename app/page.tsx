'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { quotes, Quote } from './data/quotes';
import { FaGithub } from 'react-icons/fa';
import toast, { Toaster } from 'react-hot-toast';

interface WatchRecord {
  id: number;
  date: string;
  dayOfWeek: string;
  time: number;
}

interface EditingRecord extends Omit<WatchRecord, 'time'> {
  time: string;
}

interface MonthStats {
  month: string;
  year: number;
  totalSeconds: number;
}

const Home = () => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [watchHistory, setWatchHistory] = useState<WatchRecord[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [monthStats, setMonthStats] = useState<MonthStats[]>([]);
  const [currentQuote, setCurrentQuote] = useState<Quote>({ content: '', author: '' });
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [editingRecord, setEditingRecord] = useState<EditingRecord | null>(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDayData, setNewDayData] = useState({
    date: '',
    time: '',
    dayOfWeek: ''
  });

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
    const [day, month, year] = dateStr.split(':').map(Number);
    const date = new Date(year, month - 1, day);
    
    // Get day with ordinal suffix
    const getOrdinalSuffix = (n: number): string => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    const dayWithSuffix = getOrdinalSuffix(date.getDate());
    const monthName = date.toLocaleString('default', { month: 'long' });
    
    return `${dayWithSuffix} ${monthName}, ${year}`;
  };

  // Format date to DD:MM:YYYY for storage
  const formatDateForStorage = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}:${month}:${year}`;
  };

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('watchHistory');
    if (savedHistory) {
      const history = JSON.parse(savedHistory);
      setWatchHistory(history);
      calculateMonthStats(history);
    }
  }, []);

  // Calculate monthly statistics
  const calculateMonthStats = (history: WatchRecord[]) => {
    const stats: { [key: string]: number } = {};
    
    history.forEach(record => {
      // Parse the date string properly (DD:MM:YYYY)
      const [day, month, year] = record.date.split(':');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      stats[monthYear] = (stats[monthYear] || 0) + record.time;
    });

    const monthStatsArray = Object.entries(stats).map(([monthYear, totalSeconds]) => {
      const [month, year] = monthYear.split(' ');
      return {
        month,
        year: parseInt(year),
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
  };

  // Update month stats when watch history changes
  useEffect(() => {
    if (watchHistory.length > 0) {
      calculateMonthStats(watchHistory);
    }
  }, [watchHistory]);

  // Save to localStorage whenever watchHistory changes
  useEffect(() => {
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
  }, [watchHistory]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isRunning && !isDone) {
      intervalId = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
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

    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return `${secs} second${secs > 1 ? 's' : ''}`;
    }
  };

  const formatTimeInterval = (seconds: number): string => {
    if (isNaN(seconds) || seconds === undefined) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
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

  const handleDone = () => {
    if (time > 0) {
      setIsRunning(false);
      setIsDone(true);
      
      const now = new Date();
      const formattedDate = formatDateForStorage(now);
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

      // Check if there's an entry for today
      const existingEntryIndex = watchHistory.findIndex(record => record.date === formattedDate);

      if (existingEntryIndex !== -1) {
        // Update existing entry's time
        setWatchHistory(prev => prev.map((record, index) => 
          index === existingEntryIndex 
            ? { ...record, time: record.time + time }
            : record
        ));

        toast.success('Time updated for today!', {
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
      } else {
        // Create new record with sequential ID
        const newRecord: WatchRecord = {
          id: watchHistory.length + 1,
          date: formattedDate,
          dayOfWeek: dayOfWeek,
          time: time
        };

        // Add to history
        setWatchHistory(prev => [...prev, newRecord]);

        toast.success('New entry added!', {
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
      
      // Reset timer
      setTime(0);
      // Reset isDone after a short delay to allow the user to see the completion
      setTimeout(() => {
        setIsDone(false);
      }, 1000);
    }
  };

  const handleDestroyData = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    
    // Clear the history
    setWatchHistory([]);
    // Clear localStorage
    localStorage.removeItem('watchHistory');
    // Reset confirmation state
    setShowConfirm(false);
    
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
  };

  // Calculate totals
  const totalDays = new Set(watchHistory.map(record => record.date)).size;
  const totalTimeInSeconds = watchHistory.reduce((acc, record) => acc + record.time, 0);

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
    const tableRows = watchHistory.map(record => [
      record.id,
      record.date,
      record.dayOfWeek,
      formatTime(record.time)
    ]);
    
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

  const handleEdit = (record: WatchRecord) => {
    // Convert seconds to HH:MM:SS format for editing
    const hours = Math.floor(record.time / 3600);
    const minutes = Math.floor((record.time % 3600) / 60);
    const seconds = record.time % 60;
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Convert date to readable format for editing
    const [day, month, year] = record.date.split(':').map(Number);
    const date = new Date(year, month - 1, day);
    
    setEditingRecord({ 
      ...record,
      time: formattedTime,
      date: formatReadableDate(record.date)
    });
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;

    // Validate time format (HH:MM:SS)
    const timeRegex = /^(\d{2}):(\d{2}):(\d{2})$/;
    if (!timeRegex.test(editingRecord.time)) {
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

    // Convert time string to seconds
    const [hours, minutes, seconds] = editingRecord.time.split(':').map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    // Parse the readable date back to storage format
    const dateMatch = editingRecord.date.match(/(\d+)(?:st|nd|rd|th) (\w+), (\d{4})/);
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

    // Update the record
    setWatchHistory(prev => prev.map(record => 
      record.id === editingRecord.id 
        ? { ...editingRecord, time: totalSeconds, date: formattedDate }
        : record
    ));

    setEditingRecord(null);

    toast.success('Record updated successfully!', {
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

  const handleCancelEdit = () => {
    setEditingRecord(null);
  };

  const handleInputChange = (field: keyof EditingRecord, value: string) => {
    if (!editingRecord) return;
    
    // If it's the time field, ensure proper format
    if (field === 'time') {
      // Only allow numbers and colons
      const sanitizedValue = value.replace(/[^0-9:]/g, '');
      
      // Ensure proper HH:MM:SS format
      if (sanitizedValue.length <= 8) { // Max length for HH:MM:SS
        setEditingRecord(prev => ({ ...prev!, [field]: sanitizedValue }));
      }
    } else {
      setEditingRecord(prev => ({ ...prev!, [field]: value }));
    }
  };

  const handleAddDay = () => {
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

    // Convert time string to seconds
    const [hours, minutes, seconds] = newDayData.time.split(':').map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    // Create new record
    const newRecord: WatchRecord = {
      id: watchHistory.length + 1,
      date: formattedDate,
      dayOfWeek: newDayData.dayOfWeek,
      time: totalSeconds
    };

    // Add to history
    setWatchHistory(prev => [...prev, newRecord]);
    setShowAddDay(false);
    setNewDayData({ date: '', time: '', dayOfWeek: '' });

    toast.success('New day added successfully!', {
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
              {watchHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-lg">No data found. Please add data using the timer above.</p>
                </div>
              ) : (
                <>
                  <h3 className="text-xl mb-4 text-center bg-gradient-to-r from-green-400 via-orange-400 to-green-400 bg-clip-text text-transparent font-bold">
                    You have worked for {formatTotalTime(totalTimeInSeconds)} in total
                  </h3>
                  <div className="overflow-x-auto">
                    <div className="relative p-[1px] rounded-lg">
                      {/* Gradient Border */}
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-400 via-green-400 to-orange-400"></div>
                      
                      {/* Blurry Gradient Background */}
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-500/10 via-green-500/10 to-orange-500/10 backdrop-blur-sm"></div>
                      
                      {/* Content Container */}
                      <div className="relative bg-gray-800/90 rounded-lg overflow-hidden">
                        <table className="min-w-full">
                          <thead>
                            <tr className="bg-gray-700">
                              <th className="px-4 py-2 border border-orange-500/20 text-orange-400 text-center">ID</th>
                              <th className="px-4 py-2 border border-orange-500/20 text-orange-400 text-center">Date</th>
                              <th className="px-4 py-2 border border-orange-500/20 text-orange-400 text-center">Day</th>
                              <th className="px-4 py-2 border border-orange-500/20 text-orange-400 text-center">Time</th>
                              <th className="px-4 py-2 border border-orange-500/20 text-orange-400 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-300">
                            {watchHistory.map((record) => (
                              <tr key={record.id} className="hover:bg-gray-700">
                                <td className="px-4 py-2 border border-orange-500/20 text-center">{record.id}</td>
                                <td className="px-4 py-2 border border-orange-500/20 text-center">
                                  {editingRecord?.id === record.id ? (
                                    <input
                                      type="text"
                                      value={editingRecord.date}
                                      onChange={(e) => handleInputChange('date', e.target.value)}
                                      className="bg-gray-700 text-white px-2 py-1 rounded w-full text-center"
                                      placeholder="5th May, 2025"
                                    />
                                  ) : (
                                    formatReadableDate(record.date)
                                  )}
                                </td>
                                <td className="px-4 py-2 border border-orange-500/20 text-center">
                                  {editingRecord?.id === record.id ? (
                                    <input
                                      type="text"
                                      value={editingRecord.dayOfWeek}
                                      onChange={(e) => handleInputChange('dayOfWeek', e.target.value)}
                                      className="bg-gray-700 text-white px-2 py-1 rounded w-full text-center"
                                      placeholder="Day of Week"
                                    />
                                  ) : (
                                    record.dayOfWeek
                                  )}
                                </td>
                                <td className="px-4 py-2 border border-orange-500/20 text-center">
                                  {editingRecord?.id === record.id ? (
                                    <input
                                      type="text"
                                      value={editingRecord.time}
                                      onChange={(e) => handleInputChange('time', e.target.value)}
                                      className="bg-gray-700 text-white px-2 py-1 rounded w-full text-center"
                                      placeholder="HH:MM:SS"
                                    />
                                  ) : (
                                    formatTime(record.time)
                                  )}
                                </td>
                                <td className="px-4 py-2 border border-orange-500/20 text-center">
                                  {editingRecord?.id === record.id ? (
                                    <div className="flex gap-2 justify-center">
                                      <button
                                        onClick={handleSaveEdit}
                                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={handleCancelEdit}
                                        className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleEdit(record)}
                                      className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
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
                              <td colSpan={2} className="px-4 py-2 border border-orange-500/20 text-center font-bold text-orange-400">
                                Total Days: {totalDays}
                              </td>
                              <td colSpan={3} className="px-4 py-2 border border-orange-500/20 text-center font-bold text-orange-400">
                                Total Time: {formatTime(totalTimeInSeconds)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col items-center gap-4 mt-6">
                    <div className="flex gap-4">
                      <button
                        onClick={handleExportPDF}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Export PDF
                      </button>
                      {showConfirm ? (
                        <>
                          <button
                            onClick={handleDestroyData}
                            className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 transition-colors"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setShowConfirm(false)}
                            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleDestroyData}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          Destroy All Data
                        </button>
                      )}
                    </div>
                    {showAddDay ? (
                      <div className="flex flex-col items-center gap-2 w-full">
                        <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                          <input
                            type="text"
                            value={newDayData.date}
                            onChange={(e) => setNewDayData(prev => ({ ...prev, date: e.target.value }))}
                            className="bg-gray-700 text-white px-2 py-1 rounded w-full sm:w-40 text-center"
                            placeholder="5th May, 2025"
                          />
                          <input
                            type="text"
                            value={newDayData.dayOfWeek}
                            onChange={(e) => setNewDayData(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                            className="bg-gray-700 text-white px-2 py-1 rounded w-full sm:w-32 text-center"
                            placeholder="Day of Week"
                          />
                          <input
                            type="text"
                            value={newDayData.time}
                            onChange={(e) => setNewDayData(prev => ({ ...prev, time: e.target.value }))}
                            className="bg-gray-700 text-white px-2 py-1 rounded w-full sm:w-32 text-center"
                            placeholder="HH:MM:SS"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddDay}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setShowAddDay(false);
                              setNewDayData({ date: '', time: '', dayOfWeek: '' });
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleAddDay}
                        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                      >
                        Add Your Missing Day
                      </button>
                    )}
                  </div>
                </>
              )}
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