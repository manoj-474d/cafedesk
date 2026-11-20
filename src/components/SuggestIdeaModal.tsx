import React, { useState } from 'react';
import { CheckCircle2, Lightbulb, Loader2, Send, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { SuggestionCategory } from '../types/subscription';

const CATEGORIES: SuggestionCategory[] = [
  'New Feature',
  'Improvement',
  'Cafe Information',
  'Bug',
  'Other',
];

export function SuggestIdeaModal() {
  const { user, compareList, hasPlus } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SuggestionCategory>('New Feature');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const compareBarVisible = hasPlus && compareList.length > 0;

  const resetForm = () => {
    setTitle('');
    setCategory('New Feature');
    setDetails('');
    setEmail(user?.email || '');
    setError('');
    setSubmitted(false);
  };

  const handleOpen = () => {
    setEmail((prev) => prev || user?.email || '');
    setSubmitted(false);
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (title.trim().length < 3) {
      setError('Please enter a short suggestion title (at least 3 characters).');
      return;
    }
    if (details.trim().length < 8) {
      setError('Please provide a few details so our team can act on your suggestion.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          details: details.trim(),
          email: email.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Could not submit suggestion. Please try again.');
        return;
      }
      setSubmitted(true);
      setTitle('');
      setDetails('');
    } catch {
      setError('Network error while sending your idea. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Persistent Floating Button */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Suggest an idea or feature for Cafe Desk"
        className={`fixed right-4 sm:right-6 z-40 inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-full bg-[#1c1613] hover:bg-[#312722] text-[#faf7f2] border border-[#3a2f2a] shadow-lg text-xs sm:text-sm font-semibold transition-all ${
          compareBarVisible ? 'bottom-20 sm:bottom-20' : 'bottom-5 sm:bottom-6'
        }`}
      >
        <Lightbulb className="w-4 h-4 text-[#f59e0b] shrink-0" aria-hidden="true" />
        <span>Suggest an Idea</span>
      </button>

      {/* Suggestion Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggest-idea-title"
          className="fixed inset-0 z-50 bg-[#1c1613]/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#faf7f2] border border-[#e6ddd0] shadow-2xl overflow-hidden text-[#1c1613]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 bg-[#1c1613] text-[#faf7f2] flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#f59e0b]">
                  <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Community Product Feedback</span>
                </p>
                <h2
                  id="suggest-idea-title"
                  className="font-serif-display text-2xl font-bold text-white"
                >
                  Help Us Make Cafe Desk Better
                </h2>
                <p className="text-xs text-[#faf7f2]/80 leading-relaxed">
                  Have an idea, feature request or suggestion? We would love to hear it.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close suggestion form"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {submitted ? (
                <div className="space-y-4 py-3 text-center">
                  <CheckCircle2 className="w-10 h-10 text-[#1b4d3e] mx-auto" aria-hidden="true" />
                  <div className="space-y-1">
                    <h3 className="font-serif-display text-xl font-bold text-[#1c1613]">
                      Thank you for sharing your idea!
                    </h3>
                    <p className="text-sm text-[#5c4e45] max-w-sm mx-auto">
                      Your suggestion is now logged with the Cafe Desk team for review.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-white border border-[#d6cbba] text-xs font-semibold text-[#1c1613]"
                    >
                      Submit Another Idea
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="min-h-[40px] px-5 py-2 rounded-lg bg-[#1c1613] text-white text-xs font-semibold"
                    >
                      Back to Cafe Desk
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="idea-title"
                      className="block text-xs font-semibold text-[#5c4e45] mb-1"
                    >
                      Suggestion title *
                    </label>
                    <input
                      id="idea-title"
                      type="text"
                      required
                      maxLength={120}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Filter cafes open past 11 PM in Koramangala"
                      className="w-full h-10 px-3 rounded-lg border border-[#d6cbba] bg-white text-sm text-[#1c1613]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="idea-category"
                      className="block text-xs font-semibold text-[#5c4e45] mb-1"
                    >
                      Category *
                    </label>
                    <select
                      id="idea-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as SuggestionCategory)}
                      className="w-full h-10 px-3 rounded-lg border border-[#d6cbba] bg-white text-sm font-medium text-[#1c1613]"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="idea-details"
                      className="block text-xs font-semibold text-[#5c4e45] mb-1"
                    >
                      Detailed suggestion *
                    </label>
                    <textarea
                      id="idea-details"
                      required
                      rows={4}
                      maxLength={2000}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Describe what would make Cafe Desk more useful for discovering Bengaluru cafes..."
                      className="w-full p-3 rounded-lg border border-[#d6cbba] bg-white text-sm text-[#1c1613] resize-y"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="idea-email"
                      className="block text-xs font-semibold text-[#5c4e45] mb-1"
                    >
                      Email address (optional — only if you want updates)
                    </label>
                    <input
                      id="idea-email"
                      type="email"
                      maxLength={160}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com (leave blank to submit anonymously)"
                      className="w-full h-10 px-3 rounded-lg border border-[#d6cbba] bg-white text-sm text-[#1c1613]"
                    />
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="p-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#991b1b]"
                    >
                      {error}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="min-h-[42px] px-4 py-2 rounded-lg bg-white border border-[#d6cbba] hover:bg-[#f3ede3] text-xs font-semibold text-[#1c1613]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="min-h-[42px] px-5 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Submit Suggestion</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
