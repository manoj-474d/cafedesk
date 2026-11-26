import React, { useState } from 'react';
import { ExternalLink, Eye, EyeOff, Image as ImageIcon, Plus, Save, Trash2 } from 'lucide-react';
import type { MediaAsset, NavigationItem, SiteSettings } from '../../types/cms';
import { MediaPickerModal } from './MediaPickerModal';

interface AdminNavSeoTabProps {
  mode: 'navigation' | 'seo';
  navigation: NavigationItem[];
  settings: SiteSettings;
  media: MediaAsset[];
  csrfToken: string;
  onMediaUploaded: (item: MediaAsset) => void;
  onRefreshNavigation: () => Promise<void>;
  onSaveSettings: (next: SiteSettings) => Promise<boolean>;
}

export function AdminNavSeoTab({
  mode,
  navigation,
  settings,
  media,
  csrfToken,
  onMediaUploaded,
  onRefreshNavigation,
  onSaveSettings,
}: AdminNavSeoTabProps) {
  // Navigation state
  const [navLocation, setNavLocation] = useState<'header' | 'footer'>('header');
  const [navLabel, setNavLabel] = useState('');
  const [navUrl, setNavUrl] = useState('');
  const [navOrder, setNavOrder] = useState(10);
  const [navExternal, setNavExternal] = useState(false);

  // SEO state
  const [seoForm, setSeoForm] = useState<SiteSettings>(settings);
  const [savingSeo, setSavingSeo] = useState(false);
  const [seoMsg, setSeoMsg] = useState('');
  const [ogPickerOpen, setOgPickerOpen] = useState(false);

  const handleAddNav = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navLabel.trim() || !navUrl.trim()) return;
    const res = await fetch('/api/admin/navigation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      credentials: 'include',
      body: JSON.stringify({
        location: navLocation,
        label: navLabel.trim(),
        url: navUrl.trim(),
        sort_order: navOrder,
        visible: true,
        is_external: navExternal,
      }),
    });
    if (res.ok) {
      setNavLabel('');
      setNavUrl('');
      await onRefreshNavigation();
    }
  };

  const handleUpdateNav = async (item: NavigationItem, patch: Partial<NavigationItem>) => {
    await fetch(`/api/admin/navigation/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ ...item, ...patch }),
    });
    await onRefreshNavigation();
  };

  const handleDeleteNav = async (id: number) => {
    await fetch(`/api/admin/navigation/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrfToken },
      credentials: 'include',
    });
    await onRefreshNavigation();
  };

  const handleSaveSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSeo(true);
    setSeoMsg('');
    const ok = await onSaveSettings(seoForm);
    setSavingSeo(false);
    setSeoMsg(ok ? 'SEO metadata and indexing settings saved.' : 'Failed to save SEO settings.');
  };

  if (mode === 'navigation') {
    const headerItems = navigation.filter((n) => n.location === 'header');
    const footerItems = navigation.filter((n) => n.location === 'footer');

    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-xl border border-[#e2e8f0]">
          <h2 className="text-lg font-semibold text-[#0f172a]">Navigation &amp; Footer Manager</h2>
          <p className="text-xs text-[#64748b]">
            Add, rename, reorder, hide, or remove links in the top header and site footer.
          </p>
        </div>

        {/* Add Nav Link */}
        <form
          onSubmit={handleAddNav}
          className="p-5 rounded-xl border border-[#e2e8f0] bg-white grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs"
        >
          <div className="sm:col-span-2">
            <label className="block font-semibold text-[#475569] mb-1">Menu Area</label>
            <select
              value={navLocation}
              onChange={(e) => setNavLocation(e.target.value as 'header' | 'footer')}
              className="w-full h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            >
              <option value="header">Header</option>
              <option value="footer">Footer</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block font-semibold text-[#475569] mb-1">Link Label</label>
            <input
              type="text"
              required
              value={navLabel}
              onChange={(e) => setNavLabel(e.target.value)}
              placeholder="e.g. Menu & Passes"
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block font-semibold text-[#475569] mb-1">URL / Route</label>
            <input
              type="text"
              required
              value={navUrl}
              onChange={(e) => setNavUrl(e.target.value)}
              placeholder="/locations or https://..."
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block font-semibold text-[#475569] mb-1">Order</label>
            <input
              type="number"
              value={navOrder}
              onChange={(e) => setNavOrder(Number(e.target.value))}
              className="w-full h-10 px-2 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
            />
          </div>
          <div className="sm:col-span-1 flex items-center h-10">
            <label className="inline-flex items-center gap-1 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={navExternal}
                onChange={(e) => setNavExternal(e.target.checked)}
              />
              <span>Ext</span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full h-10 px-4 rounded-lg bg-[#0f172a] text-white font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Link</span>
            </button>
          </div>
        </form>

        {/* Header & Footer Tables */}
        {[
          { title: 'Header Menu Links', items: headerItems },
          { title: 'Footer Links', items: footerItems },
        ].map((group) => (
          <div key={group.title} className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
            <h3 className="text-sm font-semibold text-[#0f172a]">{group.title}</h3>
            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center text-xs p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]"
                >
                  <input
                    type="number"
                    defaultValue={item.sort_order}
                    onBlur={(e) =>
                      handleUpdateNav(item, { sort_order: Number(e.target.value) })
                    }
                    className="col-span-1 h-8 px-2 rounded border border-[#cbd5e1] bg-white font-mono-data"
                  />
                  <input
                    type="text"
                    defaultValue={item.label}
                    onBlur={(e) => handleUpdateNav(item, { label: e.target.value })}
                    className="col-span-4 h-8 px-2.5 rounded border border-[#cbd5e1] bg-white font-semibold"
                  />
                  <input
                    type="text"
                    defaultValue={item.url}
                    onBlur={(e) => handleUpdateNav(item, { url: e.target.value })}
                    className="col-span-4 h-8 px-2.5 rounded border border-[#cbd5e1] bg-white font-mono-data"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateNav(item, { visible: !item.visible })}
                    className={`col-span-2 h-8 rounded border font-semibold inline-flex items-center justify-center gap-1 ${
                      item.visible
                        ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                        : 'bg-white border-[#cbd5e1] text-[#64748b]'
                    }`}
                  >
                    {item.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{item.visible ? 'Shown' : 'Hidden'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNav(item.id)}
                    aria-label={`Remove ${item.label}`}
                    className="col-span-1 h-8 rounded border border-[#fecaca] text-[#dc2626] flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveSeo} className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0f172a]">SEO &amp; Indexing Manager</h2>
          <p className="text-xs text-[#64748b]">
            Edit page titles, meta descriptions, social share images, and search engine indexing.
          </p>
        </div>
        <button
          type="submit"
          disabled={savingSeo}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#0f172a] text-white text-xs font-semibold whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          <span>{savingSeo ? 'Saving...' : 'Save SEO Settings'}</span>
        </button>
      </div>

      {seoMsg && (
        <div
          role="status"
          className="px-4 py-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#1b4d3e]"
        >
          {seoMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs">
          <h3 className="text-sm font-semibold text-[#0f172a]">Homepage &amp; Locations SEO</h3>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">Home Page Title</label>
            <input
              type="text"
              value={seoForm.seo_home_title}
              onChange={(e) => setSeoForm({ ...seoForm, seo_home_title: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">Home Meta Description</label>
            <textarea
              rows={2}
              value={seoForm.seo_home_description}
              onChange={(e) => setSeoForm({ ...seoForm, seo_home_description: e.target.value })}
              className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">Locations Page Title</label>
            <input
              type="text"
              value={seoForm.seo_locations_title}
              onChange={(e) => setSeoForm({ ...seoForm, seo_locations_title: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">Locations Meta Description</label>
            <textarea
              rows={2}
              value={seoForm.seo_locations_description}
              onChange={(e) =>
                setSeoForm({ ...seoForm, seo_locations_description: e.target.value })
              }
              className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
        </div>

        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs">
          <h3 className="text-sm font-semibold text-[#0f172a]">
            About, Contact, OG Image &amp; Sitemap
          </h3>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">About Page Title</label>
            <input
              type="text"
              value={seoForm.seo_about_title}
              onChange={(e) => setSeoForm({ ...seoForm, seo_about_title: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">Contact Page Title</label>
            <input
              type="text"
              value={seoForm.seo_contact_title}
              onChange={(e) => setSeoForm({ ...seoForm, seo_contact_title: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">
              Default Social Share Image (og:image)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={seoForm.seo_og_image}
                onChange={(e) => setSeoForm({ ...seoForm, seo_og_image: e.target.value })}
                className="flex-1 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
              />
              <button
                type="button"
                onClick={() => setOgPickerOpen(true)}
                className="inline-flex items-center gap-1 h-10 px-3 rounded-lg border border-[#cbd5e1] font-semibold"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Pick</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#475569] mb-1">
              Google Search Console Verification Code
            </label>
            <input
              type="text"
              value={seoForm.google_site_verification || ''}
              onChange={(e) =>
                setSeoForm({ ...seoForm, google_site_verification: e.target.value })
              }
              placeholder="Paste content token from Google Search Console HTML tag"
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
            />
            <p className="text-[11px] text-[#64748b] mt-1">
              Emits &lt;meta name=&quot;google-site-verification&quot;&gt; in HTML &amp; SPA head.
            </p>
          </div>

          <div className="pt-2 space-y-3 border-t border-[#f1f5f9]">
            <label className="inline-flex items-center gap-2 font-semibold text-[#0f172a] cursor-pointer">
              <input
                type="checkbox"
                checked={seoForm.seo_allow_indexing}
                onChange={(e) =>
                  setSeoForm({ ...seoForm, seo_allow_indexing: e.target.checked })
                }
                className="accent-[#16a34a]"
              />
              <span>Allow search engines to index public pages (robots.txt)</span>
            </label>

            <div className="flex items-center gap-4 pt-1">
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#b45309] hover:underline"
              >
                <span>View live /sitemap.xml</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="/robots.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#475569] hover:underline"
              >
                <span>View /robots.txt</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <MediaPickerModal
        open={ogPickerOpen}
        onClose={() => setOgPickerOpen(false)}
        media={media}
        csrfToken={csrfToken}
        onMediaUploaded={onMediaUploaded}
        defaultCategory="Brand Assets"
        title="Choose Default Social Sharing Image"
        onSelect={(url) => setSeoForm({ ...seoForm, seo_og_image: url })}
      />
    </form>
  );
}
