import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PlusCircle,
} from 'lucide-react';
import { useCms } from '../context/CmsContext';
import { buildWhatsAppUrl, useDocumentMeta } from '../utils/cafeHelpers';

export function ContactPage() {
  const { settings } = useCms();

  useDocumentMeta(settings.seo_contact_title, settings.seo_contact_description, {
    canonicalPath: '/contact',
    ogImage: settings.seo_og_image,
    allowIndexing: settings.seo_allow_indexing,
    googleSiteVerification: settings.google_site_verification,
  });

  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [topic, setTopic] = useState('Cafe Listing Question');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contactInfo.trim() || !message.trim()) {
      setErrorMsg('Please enter your name, contact details, and your message.');
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
          type: 'contact_enquiry',
          cafeName: topic,
          contactName: name.trim(),
          contactInfo: contactInfo.trim(),
          notes: message.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not submit enquiry.');
        setStatus('error');
        return;
      }
      setStatus('sent');
      setName('');
      setContactInfo('');
      setMessage('');
    } catch {
      setErrorMsg('Network error. Please try again or reach out via WhatsApp.');
      setStatus('error');
    }
  };

  const waUrl = buildWhatsAppUrl(
    `Hi ${settings.brand_name}! I have a question or feedback about your Bengaluru cafe directory.`,
    settings.whatsapp_number
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-16 space-y-8 sm:space-y-10">
      <div className="max-w-2xl space-y-3">
        <span className="inline-block text-xs uppercase tracking-[0.14em] font-semibold text-[#b45309]">
          Contact &amp; Community Support
        </span>
        <h1 className="font-serif-display text-3xl sm:text-5xl font-semibold text-[#1c1613] leading-tight">
          {settings.contact_heading}
        </h1>
        <p className="text-base text-[#57493f] leading-relaxed">{settings.contact_subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Direct Contact Details */}
        <aside className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-[#e6ddd0] p-5 sm:p-6 bg-white space-y-4 shadow-xs">
            <h2 className="font-serif-display text-xl font-semibold text-[#1c1613]">
              Reach our directory team
            </h2>

            <div className="space-y-3.5 text-sm text-[#57493f]">
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#b45309] shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-[#1c1613]">Phone &amp; Updates</p>
                  <a
                    href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}
                    className="hover:text-[#1c1613]"
                  >
                    {settings.contact_phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#b45309] shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-[#1c1613]">Email</p>
                  <a href={`mailto:${settings.contact_email}`} className="hover:text-[#1c1613]">
                    {settings.contact_email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#1b4d3e] shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-[#1c1613]">Support Hours</p>
                  <p>{settings.contact_hours}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#1b4d3e] shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-[#1c1613]">Bengaluru Base</p>
                  <p>{settings.business_address}</p>
                  {settings.contact_map_url && (
                    <a
                      href={settings.contact_map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 min-h-[40px] text-xs font-semibold text-[#b45309] hover:underline"
                    >
                      <span>Open on Google Maps</span>
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#e6ddd0] space-y-3">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#1b4d3e] hover:bg-[#143a2f] text-white text-sm font-semibold transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Chat on WhatsApp ({settings.whatsapp_display})</span>
              </a>

              <Link
                to="/submit"
                className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:border-[#b45309] text-[#1c1613] text-sm font-semibold transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                <span>Submit or Update a Cafe Listing</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Right: General Contact Form */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-[#e6ddd0] p-5 sm:p-8 bg-white shadow-xs">
            <div className="space-y-1 mb-6">
              <h2 className="font-serif-display text-2xl font-semibold text-[#1c1613]">
                Send us a message
              </h2>
              <p className="text-sm text-[#57493f]">
                Have a question about a cafe&apos;s Wi-Fi specs, partnership enquiries, or feedback
                for our Bengaluru directory? Reach out directly below.
              </p>
            </div>

            {status === 'sent' ? (
              <div
                role="status"
                className="rounded-xl border border-[#bbf7d0] p-6 bg-[#ecfdf5] text-[#1b4d3e] space-y-3"
              >
                <div className="flex items-center gap-2 font-semibold text-base">
                  <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>Message received &amp; saved!</span>
                </div>
                <p className="text-sm">
                  Thank you for contacting {settings.brand_name}. Our editorial team will review
                  your message and respond promptly.
                </p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="min-h-[40px] inline-flex items-center text-xs font-semibold underline underline-offset-4"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="c-name"
                      className="block text-xs font-semibold text-[#57493f] mb-1"
                    >
                      Full Name *
                    </label>
                    <input
                      id="c-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full h-11 px-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm text-[#1c1613] focus:outline-none focus:border-[#b45309]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="c-contact"
                      className="block text-xs font-semibold text-[#57493f] mb-1"
                    >
                      Phone or Email *
                    </label>
                    <input
                      id="c-contact"
                      type="text"
                      required
                      value={contactInfo}
                      onChange={(e) => setContactInfo(e.target.value)}
                      placeholder="+91 98... or email"
                      className="w-full h-11 px-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm text-[#1c1613] focus:outline-none focus:border-[#b45309]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="c-topic"
                    className="block text-xs font-semibold text-[#57493f] mb-1"
                  >
                    Topic
                  </label>
                  <select
                    id="c-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm font-medium text-[#1c1613] focus:outline-none focus:border-[#b45309]"
                  >
                    <option value="Cafe Listing Question">Cafe Listing Question</option>
                    <option value="Wi-Fi or Price Correction">Wi-Fi or Price Correction</option>
                    <option value="Cafe Owner / Partnership">Cafe Owner / Partnership</option>
                    <option value="General Feedback">General Feedback</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="c-msg"
                    className="block text-xs font-semibold text-[#57493f] mb-1"
                  >
                    Your Message *
                  </label>
                  <textarea
                    id="c-msg"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can our team help you discover better cafes in Bengaluru?"
                    className="w-full p-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm text-[#1c1613] focus:outline-none focus:border-[#b45309]"
                  />
                </div>

                {status === 'error' && errorMsg && (
                  <p role="alert" className="text-xs font-medium text-[#dc2626]">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="inline-flex items-center justify-center w-full sm:w-auto min-h-[44px] px-7 py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {status === 'submitting' ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
