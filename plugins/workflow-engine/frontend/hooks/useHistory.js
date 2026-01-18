import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for managing undo/redo history
 * @param {*} initialState - Initial state value
 * @param {number} maxHistory - Maximum number of history states to keep (default: 50)
 * @returns {Object} - { state, setState, undo, redo, canUndo, canRedo, clear }
 */
const useHistory = (initialState, maxHistory = 50) => {
    const [past, setPast] = useState([]);
    const [present, setPresent] = useState(initialState);
    const [future, setFuture] = useState([]);

    // Track if we're in the middle of an undo/redo operation
    const isUndoRedoRef = useRef(false);

    const setState = useCallback((newStateOrUpdater) => {
        // If this is an undo/redo operation, don't add to history
        if (isUndoRedoRef.current) {
            setPresent(newStateOrUpdater);
            return;
        }

        setPresent((currentPresent) => {
            const resolvedNewState = typeof newStateOrUpdater === 'function'
                ? newStateOrUpdater(currentPresent)
                : newStateOrUpdater;

            setPast((prevPast) => {
                const newPast = [...prevPast, currentPresent];
                // Limit history size
                if (newPast.length > maxHistory) {
                    return newPast.slice(newPast.length - maxHistory);
                }
                return newPast;
            });

            setFuture([]); // Clear future when new state is set
            return resolvedNewState;
        });
    }, [maxHistory]); // Removed 'present' dependency to prevent infinite loops

    const undo = useCallback(() => {
        if (past.length === 0) return;

        isUndoRedoRef.current = true;

        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);

        setPast(newPast);
        setFuture((prevFuture) => [present, ...prevFuture]);
        setPresent(previous);

        // Reset flag after state updates
        setTimeout(() => {
            isUndoRedoRef.current = false;
        }, 0);
    }, [past, present]);

    const redo = useCallback(() => {
        if (future.length === 0) return;

        isUndoRedoRef.current = true;

        const next = future[0];
        const newFuture = future.slice(1);

        setPast((prevPast) => [...prevPast, present]);
        setFuture(newFuture);
        setPresent(next);

        // Reset flag after state updates
        setTimeout(() => {
            isUndoRedoRef.current = false;
        }, 0);
    }, [future, present]);

    const clear = useCallback(() => {
        setPast([]);
        setFuture([]);
    }, []);

    return {
        state: present,
        setState,
        undo,
        redo,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        clear,
    };
};

export default useHistory;
