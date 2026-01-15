import React from 'react';

class WorkflowErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Workflow Engine Error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col h-full bg-bg-dark text-text-main p-6">
                    <div className="flex items-center justify-center h-full">
                        <div className="max-w-2xl bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-8 text-center">
                            <div className="text-6xl mb-4">⚠️</div>
                            <h2 className="text-2xl font-bold mb-4 text-red-400">
                                Something went wrong
                            </h2>
                            <p className="text-text-muted mb-6">
                                The workflow engine encountered an unexpected error.
                                {this.state.error && (
                                    <span className="block mt-2 text-sm font-mono text-red-400">
                                        {this.state.error.toString()}
                                    </span>
                                )}
                            </p>
                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={this.handleReset}
                                    className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all font-semibold"
                                >
                                    🔄 Reload Page
                                </button>
                                <button
                                    onClick={() => this.setState({ hasError: false })}
                                    className="px-6 py-3 bg-glass border border-glass-border text-text-main rounded-lg hover:bg-glass-hover transition-all font-semibold"
                                >
                                    ← Go Back
                                </button>
                            </div>
                            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                                <details className="mt-6 text-left">
                                    <summary className="cursor-pointer text-sm text-text-muted hover:text-text-main">
                                        Show error details
                                    </summary>
                                    <pre className="mt-4 p-4 bg-bg-dark rounded-lg text-xs overflow-auto max-h-64 text-red-400">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </details>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default WorkflowErrorBoundary;
