import React from 'react';

const ConfirmDialog = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmStyle = 'primary', // 'primary' or 'danger'
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Modal */}
            <div className="relative bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                {/* Title */}
                <h3 className="text-xl font-bold text-text-main mb-3">
                    {title}
                </h3>

                {/* Message */}
                <p className="text-text-muted mb-6">
                    {message}
                </p>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-glass border border-glass-border text-text-main rounded-lg hover:bg-glass-hover transition-all"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-white rounded-lg transition-all ${confirmStyle === 'danger'
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-primary hover:bg-primary-hover'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
