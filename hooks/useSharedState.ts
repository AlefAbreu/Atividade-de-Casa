import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

// Custom hook to keep state in sync with localStorage and across tabs/windows
// Fix: Update the return type to properly support functional updates, matching React's useState signature.
export const useSharedState = <T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: SetStateAction<T>) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      // REMOVED: The manual dispatch of 'storage' event is unreliable.
      // The browser natively triggers this event in other tabs when localStorage is changed, which is a more robust approach.
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // We only care about events for our specific key.
      if (event.key === key) {
         try {
            const item = window.localStorage.getItem(key);
            if (item !== null) {
                const newValue = JSON.parse(item);
                // Prevent re-render if the data hasn't actually changed.
                if (JSON.stringify(newValue) !== JSON.stringify(storedValue)) {
                    setStoredValue(newValue);
                }
            } else {
                // The item was removed from storage, so we reset to the initial value.
                setStoredValue(initialValue);
            }
         } catch(error) {
             console.error('Error handling storage change:', error);
             setStoredValue(initialValue);
         }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue, storedValue]); // Dependencies ensure the listener's closure has the latest values.

  return [storedValue, setValue];
};