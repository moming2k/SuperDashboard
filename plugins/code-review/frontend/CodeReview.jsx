import React, { useState } from 'react';
import { API_BASE } from '../../config';

function CodeReview() {
  const [activeView, setActiveView] = useState('review');
  const [code, setCode] = useState('');
  const [filename, setFilename] = useState('');
  const [reviewResult, setReviewResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // PR Description state
  const [gitDiff, setGitDiff] = useState('');
  const [branchName, setBranchName] = useState('');
  const [prResult, setPrResult] = useState(null);

  // Pre-commit state
  const [precommitFiles, setPrecommitFiles] = useState([{ filename: '', content: '' }]);
  const [precommitResult, setPrecommitResult] = useState(null);

  const severityColors = {
    critical: 'bg-red-500/20 border-red-500 text-red-300',
    high: 'bg-orange-500/20 border-orange-500 text-orange-300',
    medium: 'bg-yellow-500/20 border-yellow-500 text-yellow-300',
    low: 'bg-blue-500/20 border-blue-500 text-blue-300',
    info: 'bg-gray-500/20 border-gray-500 text-gray-300',
  };

  const categoryIcons = {
    security: '🔒',
    quality: '✨',
    performance: '⚡',
    'best-practice': '📚',
    style: '🎨',
  };

  const runReview = async (endpoint = 'review') => {
    if (!code.trim()) {
      setError('Please enter code to review');
      return;
    }

    setLoading(true);
    setError(null);
    setReviewResult(null);

    try {
      const response = await fetch(`${API_BASE}/plugins/code-review/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          filename: filename || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Review failed: ${response.statusText}`);
      }

      const data = await response.json();
      setReviewResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePRDescription = async () => {
    if (!gitDiff.trim()) {
      setError('Please enter git diff');
      return;
    }

    setLoading(true);
    setError(null);
    setPrResult(null);

    try {
      const response = await fetch(`${API_BASE}/plugins/code-review/generate-pr-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diff: gitDiff,
          branch_name: branchName || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`PR generation failed: ${response.statusText}`);
      }

      const data = await response.json();
      setPrResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runPrecommitCheck = async () => {
    const validFiles = precommitFiles.filter(f => f.filename && f.content.trim());

    if (validFiles.length === 0) {
      setError('Please add at least one file with content');
      return;
    }

    setLoading(true);
    setError(null);
    setPrecommitResult(null);

    try {
      const response = await fetch(`${API_BASE}/plugins/code-review/precommit-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: validFiles,
        }),
      });

      if (!response.ok) {
        throw new Error(`Pre-commit check failed: ${response.statusText}`);
      }

      const data = await response.json();
      setPrecommitResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addPrecommitFile = () => {
    setPrecommitFiles([...precommitFiles, { filename: '', content: '' }]);
  };

  const updatePrecommitFile = (index, field, value) => {
    const newFiles = [...precommitFiles];
    newFiles[index][field] = value;
    setPrecommitFiles(newFiles);
  };

  const removePrecommitFile = (index) => {
    setPrecommitFiles(precommitFiles.filter((_, i) => i !== index));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          AI Code Review Assistant
        </h1>
        <p className="text-text-muted">
          GPT-4 powered code analysis for security, quality, and best practices
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-glass-border">
        <button
          onClick={() => setActiveView('review')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeView === 'review'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          Code Review
        </button>
        <button
          onClick={() => setActiveView('security')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeView === 'security'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          Security Scan
        </button>
        <button
          onClick={() => setActiveView('pr')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeView === 'pr'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          PR Description
        </button>
        <button
          onClick={() => setActiveView('precommit')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeView === 'precommit'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          Pre-commit Check
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-xl text-red-300">
          {error}
        </div>
      )}

      {/* Code Review View */}
      {activeView === 'review' && (
        <div className="space-y-6">
          <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6">
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-text-muted">
                Filename (optional)
              </label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g., main.py, App.jsx"
                className="w-full bg-bg-dark border border-glass-border rounded-xl p-3 text-text-main placeholder-text-muted focus:border-primary outline-none transition-colors"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-text-muted">
                Code to Review
              </label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here..."
                rows={15}
                className="w-full bg-bg-dark border border-glass-border rounded-xl p-4 text-text-main placeholder-text-muted focus:border-primary outline-none transition-colors font-mono text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => runReview('review')}
                disabled={loading}
                className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : '🔍 Full Review'}
              </button>
              <button
                onClick={() => runReview('review/security')}
                disabled={loading}
                className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
              >
                🔒 Security Scan
              </button>
              <button
                onClick={() => runReview('review/quality')}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                ✨ Quality Check
              </button>
              <button
                onClick={() => runReview('review/best-practices')}
                disabled={loading}
                className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-all disabled:opacity-50"
              >
                📚 Best Practices
              </button>
            </div>
          </div>

          {reviewResult && (
            <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Review Results</h2>
                <div className="text-right">
                  <div className="text-sm text-text-muted mb-1">Quality Score</div>
                  <div className={`text-4xl font-bold ${getScoreColor(reviewResult.score)}`}>
                    {reviewResult.score}
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-bg-dark rounded-xl">
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-text-muted">{reviewResult.summary}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-4">
                  Issues Found ({reviewResult.issues.length})
                </h3>
                {reviewResult.issues.length === 0 ? (
                  <div className="text-center py-8 text-text-muted">
                    ✓ No issues found! Code looks good.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviewResult.issues.map((issue, index) => (
                      <div
                        key={index}
                        className={`p-4 border rounded-xl ${severityColors[issue.severity]}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{categoryIcons[issue.category]}</span>
                            <span className="font-semibold capitalize">{issue.severity}</span>
                            <span className="text-sm opacity-75">• {issue.category}</span>
                            {issue.line && (
                              <span className="text-sm opacity-75">• Line {issue.line}</span>
                            )}
                          </div>
                        </div>
                        <p className="mb-2">{issue.message}</p>
                        {issue.suggestion && (
                          <div className="mt-3 p-3 bg-black/30 rounded-lg">
                            <div className="text-xs font-semibold mb-1 opacity-75">
                              SUGGESTION
                            </div>
                            <p className="text-sm">{issue.suggestion}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Scan View */}
      {activeView === 'security' && (
        <div className="space-y-6">
          <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6">
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-text-muted">
                Filename (optional)
              </label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g., auth.py, login.jsx"
                className="w-full bg-bg-dark border border-glass-border rounded-xl p-3 text-text-main placeholder-text-muted focus:border-primary outline-none transition-colors"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-text-muted">
                Code to Scan for Security Issues
              </label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste code to scan for vulnerabilities..."
                rows={15}
                className="w-full bg-bg-dark border border-glass-border rounded-xl p-4 text-text-main placeholder-text-muted focus:border-primary outline-none transition-colors font-mono text-sm"
              />
            </div>
            <button
              onClick={() => runReview('review/security')}
              disabled={loading}
              className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Scanning...' : '🔒 Run Security Scan'}
            </button>
          </div>

          {reviewResult && (
            <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6">
              <h2 className="text-2xl font-bold mb-4">Security Scan Results</h2>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-red-300">
                    {reviewResult.issues.filter(i => i.severity === 'critical').length}
                  </div>
                  <div className="text-sm text-red-300">Critical</div>
                </div>
                <div className="bg-orange-500/20 border border-orange-500 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-orange-300">
                    {reviewResult.issues.filter(i => i.severity === 'high').length}
                  </div>
                  <div className="text-sm text-orange-300">High</div>
                </div>
                <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-300">
                    {reviewResult.issues.filter(i => i.severity === 'medium').length}
                  </div>
                  <div className="text-sm text-yellow-300">Medium</div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-bg-dark rounded-xl">
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-text-muted">{reviewResult.summary}</p>
              </div>

              <div className="space-y-3">
                {reviewResult.issues.map((issue, index) => (
                  <div
                    key={index}
                    className={`p-4 border rounded-xl ${severityColors[issue.severity]}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{issue.severity}</span>
                        {issue.line && (
                          <span className="text-sm opacity-75">Line {issue.line}</span>
                        )}
                      </div>
                    </div>
                    <p className="mb-2">{issue.message}</p>
                    {issue.suggestion && (
                      <div className="mt-3 p-3 bg-black/30 rounded-lg">
                        <div className="text-xs font-semibold mb-1 opacity-75">HOW TO FIX</div>
                        <p className="text-sm">{issue.suggestion}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PR Description Generator View */}
      {activeView === 'pr' && (
        <div className="space-y-6">
          <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6">
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-text-muted">
                Branch Name (optional)
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g., feature/user-auth"
                className="w-full bg-bg-dark border border-glass-border rounded-xl p-3 text-text-main placeholder-text-muted focus:border-primary outline-none transition-colors"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-text-muted">
                Git Diff
              </label>
              <textarea
                value={gitDiff}
                onChange={(e) => setGitDiff(e.target.value)}
                placeholder="Paste git diff output here..."
                rows={15}
                className="w-full bg-bg-dark border border-glass-border rounded-xl p-4 text-text-main placeholder-text-muted focus:border-primary outline-none transition-colors font-mono text-sm"
              />
            </div>
            <button
              onClick={generatePRDescription}
              disabled={loading}
              className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-50"
            >
              {loading ? 'Generating...' : '✨ Generate PR Description'}
            </button>
          </div>

          {prResult && (
            <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6">
              <h2 className="text-2xl font-bold mb-6">Generated PR Description</h2>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 text-text-muted">Title</label>
                <div className="bg-bg-dark border border-glass-border rounded-xl p-4">
                  <p className="font-semibold text-lg">{prResult.title}</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 text-text-muted">
                  Description
                </label>
                <div className="bg-bg-dark border border-glass-border rounded-xl p-4">
                  <p className="whitespace-pre-wrap">{prResult.description}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-text-muted">
                  Changes
                </label>
                <div className="bg-bg-dark border border-glass-border rounded-xl p-4">
                  <ul className="list-disc list-inside space-y-2">
                    {prResult.changes.map((change, index) => (
                      <li key={index}>{change}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                onClick={() => {
                  const text = `# ${prResult.title}\n\n${prResult.description}\n\n## Changes\n${prResult.changes.map(c => `- ${c}`).join('\n')}`;
                  navigator.clipboard.writeText(text);
                }}
                className="mt-6 bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-all"
              >
                📋 Copy to Clipboard
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pre-commit Check View */}
      {activeView === 'precommit' && (
        <div className="space-y-6">
          <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Files to Check</h3>

            {precommitFiles.map((file, index) => (
              <div key={index} className="mb-6 p-4 bg-bg-dark rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <input
                    type="text"
                    value={file.filename}
                    onChange={(e) => updatePrecommitFile(index, 'filename', e.target.value)}
                    placeholder="Filename (e.g., src/auth.py)"
                    className="flex-1 bg-bg-card border border-glass-border rounded-lg p-2 text-text-main placeholder-text-muted focus:border-primary outline-none transition-colors"
                  />
                  {precommitFiles.length > 1 && (
                    <button
                      onClick={() => removePrecommitFile(index)}
                      className="ml-3 text-red-400 hover:text-red-300 font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <textarea
                  value={file.content}
                  onChange={(e) => updatePrecommitFile(index, 'content', e.target.value)}
                  placeholder="File content..."
                  rows={8}
                  className="w-full bg-bg-card border border-glass-border rounded-lg p-3 text-text-main placeholder-text-muted focus:border-primary outline-none transition-colors font-mono text-sm"
                />
              </div>
            ))}

            <div className="flex gap-3">
              <button
                onClick={addPrecommitFile}
                className="bg-bg-dark border border-glass-border text-text-main px-6 py-3 rounded-xl font-semibold hover:border-primary transition-all"
              >
                + Add File
              </button>
              <button
                onClick={runPrecommitCheck}
                disabled={loading}
                className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-50"
              >
                {loading ? 'Checking...' : '✓ Run Pre-commit Check'}
              </button>
            </div>
          </div>

          {precommitResult && (
            <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6">
              <div className="mb-6">
                <div className={`text-center py-6 rounded-xl ${
                  precommitResult.passed
                    ? 'bg-green-500/20 border border-green-500'
                    : 'bg-red-500/20 border border-red-500'
                }`}>
                  <div className="text-5xl mb-2">
                    {precommitResult.passed ? '✓' : '✗'}
                  </div>
                  <div className={`text-xl font-bold ${
                    precommitResult.passed ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {precommitResult.passed ? 'All Checks Passed' : 'Issues Found'}
                  </div>
                  <p className="mt-2 text-text-muted">{precommitResult.summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-bg-dark border border-glass-border rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-text-main">
                    {precommitResult.total_issues}
                  </div>
                  <div className="text-sm text-text-muted">Total Issues</div>
                </div>
                <div className="bg-bg-dark border border-glass-border rounded-xl p-4 text-center">
                  <div className={`text-3xl font-bold ${
                    precommitResult.critical_issues > 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {precommitResult.critical_issues}
                  </div>
                  <div className="text-sm text-text-muted">Critical Issues</div>
                </div>
              </div>

              {Object.entries(precommitResult.file_reviews).map(([filename, review]) => (
                <div key={filename} className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">{filename}</h3>
                    <div className={`text-2xl font-bold ${getScoreColor(review.score)}`}>
                      {review.score}
                    </div>
                  </div>

                  {review.issues.length > 0 && (
                    <div className="space-y-2">
                      {review.issues.map((issue, index) => (
                        <div
                          key={index}
                          className={`p-3 border rounded-lg ${severityColors[issue.severity]}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold capitalize">
                              {issue.severity}
                            </span>
                            <span className="text-xs opacity-75">• {issue.category}</span>
                            {issue.line && (
                              <span className="text-xs opacity-75">• Line {issue.line}</span>
                            )}
                          </div>
                          <p className="text-sm">{issue.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CodeReview;
