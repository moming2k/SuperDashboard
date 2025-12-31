import React, { useEffect } from 'react';

const Toast = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);

        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = type === 'success'
        ? 'bg-green-500/20 border-green-500/30 text-green-400'
        : type === 'error'
            ? 'bg-red-500/20 border-red-500/30 text-red-400'
            : 'bg-primary/20 border-primary/30 text-primary';

    return (
        <div className={`fixed bottom-6 right-6 ${bgColor} border backdrop-blur-xl rounded-2xl p-4 px-6 shadow-2xl animate-slide-in-right flex items-center gap-3 min-w-[300px] max-w-[500px] z-50`}>
            <div className="flex-1">
                <p className="font-medium">{message}</p>
            </div>
            <button
                onClick={onClose}
                className="text-current opacity-60 hover:opacity-100 transition-opacity"
            >
                ✕
            </button>
        </div>
    );
};

export default Toast;
