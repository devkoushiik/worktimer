'use client';

import { useState, useEffect } from 'react';

interface WatchRecord {
  id: number;
  date: string;
  dayOfWeek: string;
  time: number;
}

const Home = () => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [watchHistory, setWatchHistory] = useState<WatchRecord[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('watchHistory');
    if (savedHistory) {
      setWatchHistory(JSON.parse(savedHistory));
    }
  }, []);

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

  const handleStart = () => {
    setIsRunning(true);
    setIsDone(false);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleDone = () => {
    if (time > 0) {
      setIsRunning(false);
      setIsDone(true);
      
      // Create new record with sequential ID
      const newRecord: WatchRecord = {
        id: watchHistory.length + 1,
        date: new Date().toLocaleDateString(),
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        time: time
      };

      // Add to history
      setWatchHistory(prev => [...prev, newRecord]);
      
      // Reset timer
      setTime(0);
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
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
            <h2 className="text-2xl font-bold text-orange-400">Watch History</h2>
            {watchHistory.length > 0 && (
              <div className="flex gap-2">
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
            )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;