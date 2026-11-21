import React, { useState } from 'react';
import { Image as ImageIcon, Plus, Save, Trash2 } from 'lucide-react';
import type { MediaAsset, SiteSettings, TestimonialItem } from '../../types/cms';
import { MediaPickerModal } from './MediaPickerModal';

interface AdminContentTabProps {
  settings: SiteSettings;
  testimonials: TestimonialItem[];
  media: MediaAsset[];
  csrfToken: string;
  onMediaUploaded: (item: MediaAsset) => void;
  onSaveSettings: (next: SiteSettings) => Promise<boolean>;
  onRefreshTestimonials: () => Promise<void>;
}

type ContentSubTab =
  | 'about'
  | 'services'
  | 'gallery'
  | 'pricing'
  | 'faqs'
  | 'announcements'
  | 'contact'
  | 'testimonials';

export function AdminContentTab({
  settings,
  testimonials,
  media,
  csrfToken,
  onMediaUploaded,
  onSaveSettings,
  onRefreshTestimonials,
}: AdminContentTabProps) {
  const [subTab, setSubTab] = useState<ContentSubTab>('about');
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [pickerTarget, setPickerTarget] = useState<
    'about_image_url' | 'services_image_url' | { galleryIdx: number } | null
  >(null);
  const [confirmDeleteTestimonial, setConfirmDeleteTestimonial] =
    useState<TestimonialItem | null>(null);

  // Testimonial creation state
  const [tAuthor, setTAuthor] = useState('');
  const [tRole, setTRole] = useState('');
  const [tBranch, setTBranch] = useState('');
  const [tQuote, setTQuote] = useState('');
  const [tDate, setTDate] = useState('');
  const [tBusy, setTBusy] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg('');
    const ok = await onSaveSettings(form);
    setSaving(false);
    setStatusMsg(ok ? 'Content changes saved and published.' : 'Could not save content.');
  };

  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tAuthor.trim() || !tQuote.trim()) return;
    setTBusy(true);
    try {
      const res = await fetch('/api/admin/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: JSON.stringify({
          author_name: tAuthor.trim(),
          author_role: tRole.trim(),
          branch_name: tBranch.trim(),
          quote: tQuote.trim(),
          verified_visit_date: tDate.trim(),
          published: true,
        }),
      });
      if (res.ok) {
        setTAuthor('');
        setTRole('');
        setTBranch('');
        setTQuote('');
        setTDate('');
        await onRefreshTestimonials();
      }
    } finally {
      setTBusy(false);
    }
  };

  const handleToggleTestimonial = async (item: TestimonialItem) => {
    await fetch(`/api/admin/testimonials/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ ...item, published: !item.published }),
    });
    await onRefreshTestimonials();
  };

  const handleDeleteTestimonial = async (id: number) => {
    await fetch(`/api/admin/testimonials/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrfToken },
      credentials: 'include',
    });
    setConfirmDeleteTestimonial(null);
    await onRefreshTestimonials();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0f172a]">Content Manager</h2>
          <p className="text-xs text-[#64748b]">
            Edit About Us, Services, Facilities, FAQs, Announcements, Contact Page, and verified Testimonials.
          </p>
        </div>

        {subTab !== 'testimonials' && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold whitespace-nowrap"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save Content'}</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div
          role="status"
          className="px-4 py-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#1b4d3e]"
        >
          {statusMsg}
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(
          [
            ['about', 'About Us'],
            ['services', 'Services & Facilities'],
            ['gallery', 'Homepage Gallery'],
            ['pricing', 'Pricing Page Copy'],
            ['faqs', 'FAQs'],
            ['announcements', 'Announcements'],
            ['contact', 'Contact Page'],
            ['testimonials', 'Testimonials'],
          ] as Array<[ContentSubTab, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSubTab(k)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              subTab === k
                ? 'bg-[#0f172a] text-white border-[#0f172a]'
                : 'bg-white text-[#475569] border-[#e2e8f0] hover:text-[#0f172a]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sub-Tab Views */}
      {subTab === 'about' && (
        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">About Heading</label>
            <input
              type="text"
              value={form.about_heading}
              onChange={(e) => setForm({ ...form, about_heading: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Lead Paragraph</label>
            <textarea
              rows={2}
              value={form.about_lead}
              onChange={(e) => setForm({ ...form, about_lead: e.target.value })}
              className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Full Story</label>
            <textarea
              rows={4}
              value={form.about_story}
              onChange={(e) => setForm({ ...form, about_story: e.target.value })}
              className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">About Feature Image</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.about_image_url}
                onChange={(e) => setForm({ ...form, about_image_url: e.target.value })}
                className="flex-1 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-mono-data"
              />
              <button
                type="button"
                onClick={() => setPickerTarget('about_image_url')}
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Choose Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {subTab === 'services' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Services Section Heading
                </label>
                <input
                  type="text"
                  value={form.services_heading}
                  onChange={(e) => setForm({ ...form, services_heading: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Services Feature Image
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.services_image_url}
                    onChange={(e) => setForm({ ...form, services_image_url: e.target.value })}
                    className="flex-1 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-mono-data"
                  />
                  <button
                    type="button"
                    onClick={() => setPickerTarget('services_image_url')}
                    className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
                  >
                    Pick
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#0f172a]">Services Cards</h3>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      services_items: [
                        ...form.services_items,
                        { title: 'New Service', description: '', highlight: '' },
                      ],
                    })
                  }
                  className="text-xs font-semibold text-[#b45309]"
                >
                  + Add Service
                </button>
              </div>
              {form.services_items.map((srv, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={srv.title}
                      onChange={(e) => {
                        const next = [...form.services_items];
                        next[idx] = { ...next[idx], title: e.target.value };
                        setForm({ ...form, services_items: next });
                      }}
                      placeholder="Service title"
                      className="flex-1 h-9 px-2.5 rounded border border-[#cbd5e1] bg-white text-xs font-semibold"
                    />
                    <input
                      type="text"
                      value={srv.highlight}
                      onChange={(e) => {
                        const next = [...form.services_items];
                        next[idx] = { ...next[idx], highlight: e.target.value };
                        setForm({ ...form, services_items: next });
                      }}
                      placeholder="Key highlight"
                      className="w-48 h-9 px-2.5 rounded border border-[#cbd5e1] bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          services_items: form.services_items.filter((_, i) => i !== idx),
                        })
                      }
                      aria-label="Remove service"
                      className="h-9 px-2.5 rounded border border-[#fecaca] text-[#dc2626]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={srv.description}
                    onChange={(e) => {
                      const next = [...form.services_items];
                      next[idx] = { ...next[idx], description: e.target.value };
                      setForm({ ...form, services_items: next });
                    }}
                    placeholder="Service description"
                    className="w-full h-9 px-2.5 rounded border border-[#cbd5e1] bg-white text-xs"
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#e2e8f0] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#0f172a]">Facilities Checklist</h3>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      facilities_items: [
                        ...form.facilities_items,
                        { name: 'New Facility', detail: '' },
                      ],
                    })
                  }
                  className="text-xs font-semibold text-[#b45309]"
                >
                  + Add Facility
                </button>
              </div>
              {form.facilities_items.map((f, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={f.name}
                    onChange={(e) => {
                      const next = [...form.facilities_items];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setForm({ ...form, facilities_items: next });
                    }}
                    placeholder="Facility name"
                    className="w-56 h-9 px-2.5 rounded border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
                  />
                  <input
                    type="text"
                    value={f.detail}
                    onChange={(e) => {
                      const next = [...form.facilities_items];
                      next[idx] = { ...next[idx], detail: e.target.value };
                      setForm({ ...form, facilities_items: next });
                    }}
                    placeholder="Detail"
                    className="flex-1 h-9 px-2.5 rounded border border-[#cbd5e1] bg-[#f8fafc] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        facilities_items: form.facilities_items.filter((_, i) => i !== idx),
                      })
                    }
                    className="h-9 px-2.5 rounded border border-[#fecaca] text-[#dc2626]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'gallery' && (
        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#0f172a]">
                Homepage Editorial Photo Gallery ({form.editorial_gallery.length})
              </h3>
              <p className="text-xs text-[#64748b]">
                Curate photographs, captions, and alt text showcased in the homepage experience strip.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  editorial_gallery: [
                    ...form.editorial_gallery,
                    { url: '', alt: '', caption: '' },
                  ],
                })
              }
              className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#b45309]"
            >
              <Plus className="w-3.5 h-3.5" /> Add Gallery Photo
            </button>
          </div>

          {form.editorial_gallery.length === 0 ? (
            <p className="text-xs text-[#64748b] py-4">
              No gallery items configured yet. Click &ldquo;Add Gallery Photo&rdquo; to add one.
            </p>
          ) : (
            <div className="space-y-3">
              {form.editorial_gallery.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] grid grid-cols-1 sm:grid-cols-12 gap-3 items-start text-xs"
                >
                  <div className="sm:col-span-3">
                    {item.url ? (
                      <img
                        src={item.url}
                        alt={item.alt || 'Gallery preview'}
                        referrerPolicy="no-referrer"
                        className="w-full h-24 object-cover rounded-lg border border-[#cbd5e1]"
                      />
                    ) : (
                      <div className="w-full h-24 rounded-lg border border-dashed border-[#cbd5e1] bg-white flex items-center justify-center text-[#94a3b8]">
                        No preview
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-9 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.url}
                        onChange={(e) => {
                          const next = [...form.editorial_gallery];
                          next[idx] = { ...next[idx], url: e.target.value };
                          setForm({ ...form, editorial_gallery: next });
                        }}
                        placeholder="Image URL (https://... or /uploads/...)"
                        className="flex-1 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white font-mono-data"
                      />
                      <button
                        type="button"
                        onClick={() => setPickerTarget({ galleryIdx: idx })}
                        className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white font-semibold"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Pick</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            editorial_gallery: form.editorial_gallery.filter((_, i) => i !== idx),
                          })
                        }
                        aria-label={`Remove gallery item ${idx + 1}`}
                        className="h-10 px-2.5 rounded-lg border border-[#fecaca] text-[#dc2626] bg-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={item.caption}
                        onChange={(e) => {
                          const next = [...form.editorial_gallery];
                          next[idx] = { ...next[idx], caption: e.target.value };
                          setForm({ ...form, editorial_gallery: next });
                        }}
                        placeholder="Caption (e.g. Quiet morning desks in Indiranagar)"
                        className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white"
                      />
                      <input
                        type="text"
                        value={item.alt}
                        onChange={(e) => {
                          const next = [...form.editorial_gallery];
                          next[idx] = { ...next[idx], alt: e.target.value };
                          setForm({ ...form, editorial_gallery: next });
                        }}
                        placeholder="SEO Alt text"
                        className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'pricing' && (
        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
          <h3 className="text-sm font-semibold text-[#0f172a]">Pricing Page Headlines</h3>
          <p className="text-xs text-[#64748b]">
            Customize the hero headline and subtitle shown on the public Membership &amp; Pricing page.
          </p>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">
              Pricing Hero Headline
            </label>
            <input
              type="text"
              value={form.pricing_headline ?? ''}
              onChange={(e) => setForm({ ...form, pricing_headline: e.target.value })}
              placeholder="Unlock Unlimited Cafe Discovery Across Bengaluru"
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">
              Pricing Hero Subtitle
            </label>
            <textarea
              rows={3}
              value={form.pricing_subtitle ?? ''}
              onChange={(e) => setForm({ ...form, pricing_subtitle: e.target.value })}
              placeholder="Start free with essential Wi-Fi & seating insights..."
              className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
          </div>
        </div>
      )}

      {subTab === 'faqs' && (
        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0f172a]">Frequently Asked Questions</h3>
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  faqs_items: [...form.faqs_items, { question: '', answer: '' }],
                })
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309]"
            >
              <Plus className="w-3.5 h-3.5" /> Add FAQ
            </button>
          </div>
          {form.faqs_items.map((faq, idx) => (
            <div key={idx} className="p-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => {
                    const next = [...form.faqs_items];
                    next[idx] = { ...next[idx], question: e.target.value };
                    setForm({ ...form, faqs_items: next });
                  }}
                  placeholder="Question"
                  className="flex-1 h-9 px-3 rounded border border-[#cbd5e1] bg-white text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      faqs_items: form.faqs_items.filter((_, i) => i !== idx),
                    })
                  }
                  className="h-9 px-2.5 rounded border border-[#fecaca] text-[#dc2626]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                rows={2}
                value={faq.answer}
                onChange={(e) => {
                  const next = [...form.faqs_items];
                  next[idx] = { ...next[idx], answer: e.target.value };
                  setForm({ ...form, faqs_items: next });
                }}
                placeholder="Answer"
                className="w-full p-2.5 rounded border border-[#cbd5e1] bg-white text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {subTab === 'announcements' && (
        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0f172a]">
              Website Announcements &amp; Offers Strip
            </h3>
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  announcements: [
                    ...form.announcements,
                    {
                      id: `ann-${Date.now()}`,
                      title: 'New Announcement',
                      detail: '',
                      badge: 'Update',
                      link: '/locations',
                      active: true,
                    },
                  ],
                })
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309]"
            >
              <Plus className="w-3.5 h-3.5" /> Add Announcement
            </button>
          </div>

          {form.announcements.map((ann, idx) => (
            <div key={ann.id} className="p-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={ann.badge}
                  onChange={(e) => {
                    const next = [...form.announcements];
                    next[idx] = { ...next[idx], badge: e.target.value };
                    setForm({ ...form, announcements: next });
                  }}
                  placeholder="Badge"
                  className="sm:col-span-3 h-9 px-2.5 rounded border border-[#cbd5e1] bg-white text-xs"
                />
                <input
                  type="text"
                  value={ann.title}
                  onChange={(e) => {
                    const next = [...form.announcements];
                    next[idx] = { ...next[idx], title: e.target.value };
                    setForm({ ...form, announcements: next });
                  }}
                  placeholder="Title"
                  className="sm:col-span-5 h-9 px-2.5 rounded border border-[#cbd5e1] bg-white text-xs font-semibold"
                />
                <input
                  type="text"
                  value={ann.link}
                  onChange={(e) => {
                    const next = [...form.announcements];
                    next[idx] = { ...next[idx], link: e.target.value };
                    setForm({ ...form, announcements: next });
                  }}
                  placeholder="Target link"
                  className="sm:col-span-2 h-9 px-2.5 rounded border border-[#cbd5e1] bg-white text-xs"
                />
                <label className="sm:col-span-1 inline-flex items-center gap-1 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={ann.active}
                    onChange={(e) => {
                      const next = [...form.announcements];
                      next[idx] = { ...next[idx], active: e.target.checked };
                      setForm({ ...form, announcements: next });
                    }}
                  />
                  <span>On</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      announcements: form.announcements.filter((_, i) => i !== idx),
                    })
                  }
                  className="sm:col-span-1 h-9 rounded border border-[#fecaca] text-[#dc2626] flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={ann.detail}
                onChange={(e) => {
                  const next = [...form.announcements];
                  next[idx] = { ...next[idx], detail: e.target.value };
                  setForm({ ...form, announcements: next });
                }}
                placeholder="Announcement details..."
                className="w-full h-9 px-2.5 rounded border border-[#cbd5e1] bg-white text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {subTab === 'contact' && (
        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Contact Heading</label>
            <input
              type="text"
              value={form.contact_heading}
              onChange={(e) => setForm({ ...form, contact_heading: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Contact Subtitle</label>
            <textarea
              rows={2}
              value={form.contact_subtitle}
              onChange={(e) => setForm({ ...form, contact_subtitle: e.target.value })}
              className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Concierge Hours</label>
              <input
                type="text"
                value={form.contact_hours}
                onChange={(e) => setForm({ ...form, contact_hours: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">HQ Google Maps URL</label>
              <input
                type="url"
                value={form.contact_map_url}
                onChange={(e) => setForm({ ...form, contact_map_url: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {subTab === 'testimonials' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddTestimonial}
            className="lg:col-span-5 p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-3"
          >
            <h3 className="text-sm font-semibold text-[#0f172a]">Add Verified Guest Testimonial</h3>
            <p className="text-xs text-[#64748b]">
              Only add genuine customer feedback. Testimonials appear on the homepage when published.
            </p>
            <input
              type="text"
              required
              value={tAuthor}
              onChange={(e) => setTAuthor(e.target.value)}
              placeholder="Customer full name *"
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
            />
            <input
              type="text"
              value={tRole}
              onChange={(e) => setTRole(e.target.value)}
              placeholder="Role / organization (e.g. Product Designer)"
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={tBranch}
                onChange={(e) => setTBranch(e.target.value)}
                placeholder="Branch visited"
                className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
              />
              <input
                type="text"
                value={tDate}
                onChange={(e) => setTDate(e.target.value)}
                placeholder="Visit date (e.g. Nov 2026)"
                className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
              />
            </div>
            <textarea
              required
              rows={3}
              value={tQuote}
              onChange={(e) => setTQuote(e.target.value)}
              placeholder="Verified customer quote *"
              className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
            />
            <button
              type="submit"
              disabled={tBusy}
              className="w-full h-10 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
            >
              {tBusy ? 'Adding...' : 'Publish Verified Testimonial'}
            </button>
          </form>

          <div className="lg:col-span-7 p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
            <h3 className="text-sm font-semibold text-[#0f172a]">
              Saved Testimonials ({testimonials.length})
            </h3>
            {testimonials.length === 0 ? (
              <p className="text-xs text-[#64748b] py-6">
                No customer testimonials added yet. Add genuine verified quotes on the left.
              </p>
            ) : (
              <div className="space-y-3">
                {testimonials.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1 text-xs">
                      <p className="text-[#0f172a] italic">&ldquo;{t.quote}&rdquo;</p>
                      <p className="font-semibold text-[#475569]">
                        {t.author_name} {t.author_role ? `· ${t.author_role}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTestimonial(t)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                          t.published
                            ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                            : 'bg-white border-[#cbd5e1] text-[#64748b]'
                        }`}
                      >
                        {t.published ? 'Published' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTestimonial(t)}
                        aria-label="Delete testimonial"
                        className="p-1.5 rounded border border-[#fecaca] text-[#dc2626]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDeleteTestimonial && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm testimonial removal"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a]">Delete Testimonial?</h3>
            <p className="text-xs text-[#475569]">
              Remove guest testimonial by{' '}
              <span className="font-semibold text-[#0f172a]">
                {confirmDeleteTestimonial.author_name}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTestimonial(null)}
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteTestimonial(confirmDeleteTestimonial.id)}
                className="h-9 px-4 rounded-lg bg-[#dc2626] text-white text-xs font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <MediaPickerModal
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        media={media}
        csrfToken={csrfToken}
        onMediaUploaded={onMediaUploaded}
        defaultCategory="Hero & Interiors"
        title="Select Feature Image"
        onSelect={(url, altText) => {
          if (!pickerTarget) return;
          if (typeof pickerTarget === 'string') {
            setForm({ ...form, [pickerTarget]: url });
          } else {
            const next = [...form.editorial_gallery];
            const existing = next[pickerTarget.galleryIdx];
            if (existing) {
              next[pickerTarget.galleryIdx] = {
                ...existing,
                url,
                alt: existing.alt || altText || '',
              };
              setForm({ ...form, editorial_gallery: next });
            }
          }
        }}
      />
    </div>
  );
}
