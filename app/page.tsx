'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { quotes, Quote } from './data/quotes';

interface WatchRecord {
  id: number;
  date: string;
  dayOfWeek: string;
  time: number;
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

  // Format date to DD:MM:YYYY
  const formatDate = (date: Date): string => {
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
    setTime(0); // Reset time when starting new session
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleDone = () => {
    if (time > 0) {
      setIsRunning(false);
      setIsDone(true);
      
      const now = new Date();
      // Create new record with sequential ID
      const newRecord: WatchRecord = {
        id: watchHistory.length + 1,
        date: formatDate(now),
        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
        time: time
      };

      // Add to history
      setWatchHistory(prev => [...prev, newRecord]);
      
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
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
      <div className='flex gap-2'>
        <span className='text-3xl'>⌛</span><h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-orange-400 via-green-400 to-orange-400 bg-clip-text text-transparent">
           Work Timer
        </h1>
      </div>

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

      <div className="bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-4xl border border-orange-500/20">
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-orange-400">Work History</h2>
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
                <table className="min-w-full bg-gray-800 border border-orange-500/20">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="px-4 py-2 border border-orange-500/20 text-orange-400">ID</th>
                      <th className="px-4 py-2 border border-orange-500/20 text-orange-400">Date</th>
                      <th className="px-4 py-2 border border-orange-500/20 text-orange-400">Day</th>
                      <th className="px-4 py-2 border border-orange-500/20 text-orange-400">Time</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {watchHistory.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-700">
                        <td className="px-4 py-2 border border-orange-500/20 text-center">{record.id}</td>
                        <td className="px-4 py-2 border border-orange-500/20 text-center">{record.date}</td>
                        <td className="px-4 py-2 border border-orange-500/20 text-center">{record.dayOfWeek}</td>
                        <td className="px-4 py-2 border border-orange-500/20 text-center">{formatTime(record.time)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-700">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 border border-orange-500/20 text-center font-bold text-orange-400">
                        Total Days: {totalDays}
                      </td>
                      <td colSpan={2} className="px-4 py-2 border border-orange-500/20 text-center font-bold text-orange-400">
                        Total Time: {formatTime(totalTimeInSeconds)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-4 mt-6">
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
            </>
          )}
        </div>
      </div>
      <footer className="mt-8 text-center">
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
  );
};

export default Home;