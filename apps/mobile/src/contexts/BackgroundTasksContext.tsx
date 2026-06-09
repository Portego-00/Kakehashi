import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BackgroundTasksContextType {
  isRunning: boolean;
  progress: number;
  setIsRunning: (running: boolean) => void;
  setProgress: (progress: number) => void;
}

const BackgroundTasksContext = createContext<BackgroundTasksContextType | undefined>(undefined);

export const BackgroundTasksProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <BackgroundTasksContext.Provider 
      value={{ 
        isRunning, 
        progress, 
        setIsRunning, 
        setProgress 
      }}
    >
      {children}
    </BackgroundTasksContext.Provider>
  );
};

export const useBackgroundTasks = (): BackgroundTasksContextType => {
  const context = useContext(BackgroundTasksContext);
  if (!context) {
    throw new Error('useBackgroundTasks must be used within a BackgroundTasksProvider');
  }
  return context;
};