import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { BENGALURU_AREAS } from '../config/constants';
import { useCms } from '../context/CmsContext';
import { buildWhatsAppUrl, useDocumentMeta } from '../utils/cafeHelpers';

export function SubmitCafePage() {
  const { settings } = useCms();
  const [searchParams] = useSearchParams();
  const prefilledCafe = searchParams.get('cafe') ?? '';

  useDocumentMeta(
    `Submit a Cafe or Report an Update – ${settings.brand_name}`,
    'Suggest a work or study-friendly cafe or report outdated WiFi speeds, timings, or socket counts.',
    { allowIndexing: settings.seo_allow_indexing }
  );

  const [submissionType, setSubmissionType] = useState<'new' | 'update'>(
    prefilledCafe ? 'update' : 'new'
  );
  const [cafeName, setCafeName] = useState(prefilledCafe);
  const [area, setArea] = useState('');
  const [mapOrAddress, setMapOrAddress] = useState('');
  const [wifiAndSockets, setWifiAndSockets] = useState('');
  const [notes, setNotes] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (prefilledCafe) {
      setSubmissionType('update');
      setCafeName(prefilledCafe);
    }
  }, [prefilledCafe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeName.trim() || !notes.trim()) {
      setErrorMsg('Please enter the cafe name and the details or changes you noticed.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: submissionType === 'update' ? 'cafe_update' : 'cafe_suggest',
          cafeName: cafeName.trim(),
          area: area || 'Not specified',
          contactName: submitterName.trim() || 'Community Contributor',
          mapOrAddress: mapOrAddress.trim(),
          wifiAndSockets: wifiAndSockets.trim(),
          notes: notes.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not save submission.');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  const waUrl = buildWhatsAppUrl(
    `CafeDesk ${submissionType === 'update' ? 'Update Report' : 'Cafe Suggestion'}: ${cafeName} (${area || 'Bengaluru'}) — ${notes}`,
    settings.whatsapp_number
  );

  const resetForm = () => {
    setStatus('idle');
    setCafeName('');
    setArea('');
    setMapOrAddress('');
    setWifiAndSockets('');
    setNotes('');
    setSubmitterName('');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
          Directory Corrections &amp; Tips
        </p>
        <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1613]">
          {submissionType === 'update' ? 'Report a cafe update' : 'Suggest a cafe workspace'}
        </h1>
        <p className="text-base text-[#5c4e45] leading-relaxed">
          Help keep our verified directory accurate. Send a new cafe tip or updated WiFi, plug, or
          pricing info directly to our editorial team.
        </p>
      </div>

      {status === 'sent' ? (
        <div
          role="status"
          className="p-6 sm:p-8 rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] space-y-4"
        >
          <div className="flex items-center gap-2 font-bold text-lg">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            <span>Submission saved for admin verification!</span>
          </div>
          <p className="text-sm leading-relaxed">
            Our team reviews every update in the dashboard before publishing changes.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-lg bg-[#1b4d3e] text-white text-sm font-semibold"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span>Also send via WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={resetForm}
              className="min-h-[42px] px-4 py-2 rounded-lg border border-[#1b4d3e]/30 text-sm font-semibold"
            >
              Submit another
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="p-6 sm:p-8 rounded-2xl bg-white border border-[#e6ddd0] space-y-5"
        >
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-[#5c4e45]">Submission Type</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer text-sm font-semibold transition-colors ${
                  submissionType === 'new'
                    ? 'border-[#b45309] bg-[#f3ede3] text-[#1c1613]'
                    : 'border-[#d6cbba] bg-[#faf7f2] text-[#5c4e45]'
                }`}
              >
                <input
                  type="radio"
                  name="submissionType"
                  value="new"
                  checked={submissionType === 'new'}
                  onChange={() => setSubmissionType('new')}
                  className="accent-[#b45309]"
                />
                <span>Suggest a new cafe</span>
              </label>

              <label
                className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer text-sm font-semibold transition-colors ${
                  submissionType === 'update'
                    ? 'border-[#b45309] bg-[#f3ede3] text-[#1c1613]'
                    : 'border-[#d6cbba] bg-[#faf7f2] text-[#5c4e45]'
                }`}
              >
                <input
                  type="radio"
                  name="submissionType"
                  value="update"
                  checked={submissionType === 'update'}
                  onChange={() => setSubmissionType('update')}
                  className="accent-[#b45309]"
                />
                <span>Report an update / correction</span>
              </label>
            </div>
          </fieldset>

          <div>
            <label htmlFor="sub-name" className="block text-xs font-semibold text-[#5c4e45] mb-1">
              Cafe Name *
            </label>
            <input
              id="sub-name"
              type="text"
              required
              value={cafeName}
              onChange={(e) => setCafeName(e.target.value)}
              placeholder="e.g. Third Wave Coffee — 12th Main"
              className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sub-area" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                Neighbourhood / Area
              </label>
              <select
                id="sub-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
              >
                <option value="">Select area</option>
                {BENGALURU_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                <option value="Other area">Other city / area</option>
              </select>
            </div>

            <div>
              <label htmlFor="sub-map" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                Google Maps Link or Street
              </label>
              <input
                id="sub-map"
                type="text"
                value={mapOrAddress}
                onChange={(e) => setMapOrAddress(e.target.value)}
                placeholder="Paste Maps link or landmark"
                className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sub-specs" className="block text-xs font-semibold text-[#5c4e45] mb-1">
              WiFi Speed, Sockets, or Cost Details (optional)
            </label>
            <input
              id="sub-specs"
              type="text"
              value={wifiAndSockets}
              onChange={(e) => setWifiAndSockets(e.target.value)}
              placeholder="e.g. ~80 Mbps WiFi, wall sockets, ₹180 filter coffee"
              className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
            />
          </div>

          <div>
            <label htmlFor="sub-notes" className="block text-xs font-semibold text-[#5c4e45] mb-1">
              {submissionType === 'update'
                ? 'What changed or needs updating? *'
                : 'Why is this space great for work, reading, or meetings? *'}
            </label>
            <textarea
              id="sub-notes"
              required
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Share timings, noise level, minimum spend rules, or student deals..."
              className="w-full p-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
            />
          </div>

          <div>
            <label htmlFor="sub-person" className="block text-xs font-semibold text-[#5c4e45] mb-1">
              Your Name (optional)
            </label>
            <input
              id="sub-person"
              type="text"
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              placeholder="So we can credit or thank you"
              className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
            />
          </div>

          {status === 'error' && errorMsg && (
            <p role="alert" className="text-xs font-semibold text-[#b91c1c]">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            style={{ backgroundColor: settings.accent_color || '#b45309' }}
            className="w-full sm:w-auto min-h-[46px] px-7 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-95 disabled:opacity-60 transition-opacity"
          >
            {status === 'submitting' ? 'Submitting...' : 'Submit for Review'}
          </button>
        </form>
      )}
    </div>
  );
}
