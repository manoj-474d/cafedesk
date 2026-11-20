import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Image as ImageIcon, Save } from 'lucide-react';
import type {
  HomepageSectionConfig,
  LocationItem,
  MediaAsset,
  SiteSettings,
} from '../../types/cms';
import { MediaPickerModal } from './MediaPickerModal';

interface AdminHomepageTabProps {
  settings: SiteSettings;
  locations: LocationItem[];
  media: MediaAsset[];
  csrfToken: string;
  onMediaUploaded: (item: MediaAsset) => void;
  onSaveSettings: (next: SiteSettings) => Promise<boolean>;
}

function toLocalDatetimeInput(val?: string): string {
  if (!val) return '';
  const ts = Date.parse(val);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(ts - offset).toISOString().slice(0, 16);
}

export function AdminHomepageTab({
  settings,
  locations,
  media,
  csrfToken,
  onMediaUploaded,
  onSaveSettings,
}: AdminHomepageTabProps) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [pickerTarget, setPickerTarget] = useState<'hero_image_url' | 'hero_bg_image_url' | null>(null);

  const sortedSections = [...form.homepage_sections].sort((a, b) => a.order - b.order);

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...sortedSections];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    const reordered: HomepageSectionConfig[] = next.map((sec, i) => ({ ...sec, order: i + 1 }));
    setForm({ ...form, homepage_sections: reordered });
  };

  const toggleSection = (key: HomepageSectionConfig['key']) => {
    setForm({
      ...form,
      homepage_sections: form.homepage_sections.map((s) =>
        s.key === key ? { ...s, visible: !s.visible } : s
      ),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    const ok = await onSaveSettings(form);
    setSaving(false);
    setStatusMsg(ok ? 'Homepage changes saved and published.' : 'Failed to save changes.');
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-[#e2e8f0]">
        <div>
          <h2 className="text-lg font-semibold text-[#0f172a]">Homepage Editor</h2>
          <p className="text-xs text-[#64748b]">
            Edit hero copy, photography, call-to-action buttons, announcement bar, and section order.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          <span>{saving ? 'Publishing...' : 'Save & Publish Homepage'}</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="px-4 py-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#1b4d3e]"
        >
          {statusMsg}
        </div>
      )}

      {/* Hero Headline & Media */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
          <h3 className="text-sm font-semibold text-[#0f172a] border-b border-[#f1f5f9] pb-2">
            Hero Content &amp; Buttons
          </h3>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Hero Kicker</label>
            <input
              type="text"
              value={form.hero_kicker}
              onChange={(e) => setForm({ ...form, hero_kicker: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Hero Headline</label>
            <input
              type="text"
              value={form.hero_tagline}
              onChange={(e) => setForm({ ...form, hero_tagline: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Hero Description</label>
            <textarea
              rows={3}
              value={form.hero_subtitle}
              onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })}
              className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Primary CTA Label</label>
              <input
                type="text"
                value={form.hero_cta_primary_label}
                onChange={(e) => setForm({ ...form, hero_cta_primary_label: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Primary CTA URL</label>
              <input
                type="text"
                value={form.hero_cta_primary_link}
                onChange={(e) => setForm({ ...form, hero_cta_primary_link: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Secondary CTA Label</label>
              <input
                type="text"
                value={form.hero_cta_secondary_label}
                onChange={(e) => setForm({ ...form, hero_cta_secondary_label: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Secondary CTA URL</label>
              <input
                type="text"
                value={form.hero_cta_secondary_link}
                onChange={(e) => setForm({ ...form, hero_cta_secondary_link: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Third CTA Label</label>
              <input
                type="text"
                value={form.hero_cta_tertiary_label}
                onChange={(e) => setForm({ ...form, hero_cta_tertiary_label: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Third CTA URL</label>
              <input
                type="text"
                value={form.hero_cta_tertiary_link}
                onChange={(e) => setForm({ ...form, hero_cta_tertiary_link: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
              />
            </div>
          </div>
        </div>

        {/* Hero Photography & Promo Bar */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
            <h3 className="text-sm font-semibold text-[#0f172a] border-b border-[#f1f5f9] pb-2">
              Hero Background Photograph
            </h3>

            <div className="aspect-[16/9] rounded-lg overflow-hidden border border-[#e2e8f0] bg-[#f8fafc]">
              {form.hero_bg_image_url ? (
                <img
                  src={form.hero_bg_image_url}
                  alt="Hero preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.hero_bg_image_url}
                onChange={(e) => setForm({ ...form, hero_bg_image_url: e.target.value })}
                className="flex-1 h-9 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-mono-data"
              />
              <button
                type="button"
                onClick={() => setPickerTarget('hero_bg_image_url')}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-semibold whitespace-nowrap"
              >
                <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Choose Photo</span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0f172a]">Top Announcement Bar</h3>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.banner_enabled}
                  onChange={(e) => setForm({ ...form, banner_enabled: e.target.checked })}
                  className="accent-[#1b4d3e]"
                />
                <span>Visible</span>
              </label>
            </div>
            <input
              type="text"
              value={form.banner_text}
              onChange={(e) => setForm({ ...form, banner_text: e.target.value })}
              placeholder="Announcement text..."
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={form.banner_cta_label}
                onChange={(e) => setForm({ ...form, banner_cta_label: e.target.value })}
                placeholder="CTA label"
                className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
              />
              <input
                type="text"
                value={form.banner_link}
                onChange={(e) => setForm({ ...form, banner_link: e.target.value })}
                placeholder="Link URL"
                className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                  Start Schedule (optional)
                </label>
                <input
                  type="datetime-local"
                  value={toLocalDatetimeInput(form.banner_start_at)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      banner_start_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : '',
                    })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-mono-data"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                  End Schedule (optional)
                </label>
                <input
                  type="datetime-local"
                  value={toLocalDatetimeInput(form.banner_end_at)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      banner_end_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : '',
                    })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-mono-data"
                />
              </div>
            </div>
          </div>

          {/* Cafe of the Day Editorial Spotlight Override */}
          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[#0f172a]">Cafe of the Day Spotlight</h3>
              <p className="text-xs text-[#64748b]">
                Pin a specific cafe as today&apos;s featured homepage highlight, or leave on automatic daily rotation.
              </p>
            </div>
            <select
              aria-label="Cafe of the Day selection"
              value={form.cafe_of_the_day_slug ?? ''}
              onChange={(e) => setForm({ ...form, cafe_of_the_day_slug: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold text-[#0f172a]"
            >
              <option value="">Automatic Daily Rotation (Featured / Verified Cafes)</option>
              {locations
                .filter((l) => l.published)
                .map((loc) => (
                  <option key={loc.id} value={loc.slug}>
                    {loc.name} — {loc.area}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section Ordering & Show/Hide */}
      <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a]">
            Homepage Section Order &amp; Visibility
          </h3>
          <p className="text-xs text-[#64748b]">
            Reorder sections or hide sections without touching code.
          </p>
        </div>

        <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-xl overflow-hidden">
          {sortedSections.map((sec, idx) => (
            <div
              key={sec.key}
              className="px-4 py-3 flex items-center justify-between gap-4 bg-white hover:bg-[#f8fafc]"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono-data text-xs text-[#64748b] w-6">0{idx + 1}</span>
                <span className="text-sm font-medium text-[#0f172a]">{sec.label}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSection(sec.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                    sec.visible
                      ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#1b4d3e]'
                      : 'bg-[#f1f5f9] border-[#cbd5e1] text-[#64748b]'
                  }`}
                >
                  {sec.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{sec.visible ? 'Shown' : 'Hidden'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => moveSection(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move ${sec.label} up`}
                  className="w-8 h-8 rounded-md border border-[#cbd5e1] flex items-center justify-center disabled:opacity-40"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(idx, 1)}
                  disabled={idx === sortedSections.length - 1}
                  aria-label={`Move ${sec.label} down`}
                  className="w-8 h-8 rounded-md border border-[#cbd5e1] flex items-center justify-center disabled:opacity-40"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MediaPickerModal
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        media={media}
        csrfToken={csrfToken}
        onMediaUploaded={onMediaUploaded}
        defaultCategory="Hero & Interiors"
        title="Choose Hero Photograph"
        onSelect={(url) => {
          if (pickerTarget === 'hero_bg_image_url') {
            setForm({ ...form, hero_bg_image_url: url, hero_image_url: url });
          }
        }}
      />
    </form>
  );
}
