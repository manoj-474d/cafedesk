import React, { useState } from 'react';
import { Check, Copy, RefreshCw, Trash2, Upload } from 'lucide-react';
import type { MediaAsset } from '../../types/cms';

interface AdminMediaTabProps {
  media: MediaAsset[];
  csrfToken: string;
  onRefreshMedia: () => Promise<void>;
}

const CATEGORIES = [
  'Hero & Interiors',
  'Coffee & Food',
  'Workspace & People',
  'Branch Photos',
  'Brand Assets',
];

export function AdminMediaTab({ media, csrfToken, onRefreshMedia }: AdminMediaTabProps) {
  const [filterCat, setFilterCat] = useState('All');
  const [uploadCat, setUploadCat] = useState('Branch Photos');
  const [uploadAlt, setUploadAlt] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('');

  const allCats = ['All', ...Array.from(new Set([...CATEGORIES, ...media.map((m) => m.category)]))];
  const visible =
    filterCat === 'All' ? media : media.filter((m) => (m.category || 'General') === filterCat);

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMsg('Only PNG, JPEG, or WebP images are allowed.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg('Image must be smaller than 4 MB.');
      return;
    }
    setErrorMsg('');
    setPreviewFileName(file.name);
    if (!uploadAlt) setUploadAlt(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = () => setPreviewDataUrl(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  };

  const handleConfirmUpload = async () => {
    if (!previewDataUrl) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: JSON.stringify({
          dataUrl: previewDataUrl,
          fileName: previewFileName,
          altText: uploadAlt.trim() || previewFileName,
          description: uploadDesc.trim(),
          category: uploadCat,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Upload failed.');
        return;
      }
      setPreviewDataUrl(null);
      setPreviewFileName('');
      setUploadAlt('');
      setUploadDesc('');
      await onRefreshMedia();
    } finally {
      setBusy(false);
    }
  };

  const handleReplaceImage = (item: MediaAsset, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      await fetch(`/api/admin/media/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: JSON.stringify({
          dataUrl: String(reader.result ?? ''),
          fileName: file.name,
          altText: item.alt_text,
          description: item.description,
          category: item.category,
        }),
      });
      setBusy(false);
      await onRefreshMedia();
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMeta = async (id: number) => {
    await fetch(`/api/admin/media/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      credentials: 'include',
      body: JSON.stringify({
        altText: editAlt,
        description: editDesc,
        category: editCat,
      }),
    });
    setEditingId(null);
    await onRefreshMedia();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/media/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrfToken },
      credentials: 'include',
    });
    await onRefreshMedia();
  };

  const copyUrl = (id: number, url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0]">
        <h2 className="text-lg font-semibold text-[#0f172a]">Image &amp; Media Library</h2>
        <p className="text-xs text-[#64748b]">
          Upload photographs, preview before publishing, organize by category, replace files, or update alt descriptions.
        </p>
      </div>

      {/* Upload Box with Preview */}
      <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Folder / Category</label>
            <select
              value={uploadCat}
              onChange={(e) => setUploadCat(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Alt Text (Accessibility &amp; SEO)</label>
            <input
              type="text"
              value={uploadAlt}
              onChange={(e) => setUploadAlt(e.target.value)}
              placeholder="Describe what the photo shows..."
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Notes / Description</label>
            <input
              type="text"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="Optional internal note"
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] text-xs font-semibold cursor-pointer">
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>Select PNG, JPEG, or WebP File</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleSelectFile}
              className="sr-only"
            />
          </label>

          {previewDataUrl && (
            <div className="flex items-center gap-3">
              <img
                src={previewDataUrl}
                alt="Upload preview"
                className="w-14 h-10 rounded object-cover border border-[#cbd5e1]"
              />
              <button
                type="button"
                onClick={handleConfirmUpload}
                disabled={busy}
                className="h-10 px-4 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
              >
                {busy ? 'Publishing...' : 'Publish to Media Library'}
              </button>
              <button
                type="button"
                onClick={() => setPreviewDataUrl(null)}
                className="text-xs text-[#64748b]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <p role="alert" className="text-xs font-semibold text-[#dc2626]">
            {errorMsg}
          </p>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {allCats.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              filterCat === cat
                ? 'bg-[#0f172a] text-white border-[#0f172a]'
                : 'bg-white text-[#475569] border-[#e2e8f0]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden flex flex-col"
          >
            <div className="aspect-[16/10] bg-[#f1f5f9] overflow-hidden">
              <img
                src={item.url}
                alt={item.alt_text}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editAlt}
                    onChange={(e) => setEditAlt(e.target.value)}
                    placeholder="Alt text"
                    className="w-full h-8 px-2.5 rounded border border-[#cbd5e1]"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description"
                    className="w-full h-8 px-2.5 rounded border border-[#cbd5e1]"
                  />
                  <select
                    value={editCat}
                    onChange={(e) => setEditCat(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-[#cbd5e1]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveMeta(item.id)}
                      className="px-3 py-1 rounded bg-[#0f172a] text-white font-semibold"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 rounded border border-[#cbd5e1]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#0f172a] truncate">{item.original_name}</p>
                    <span className="font-mono-data text-[11px] text-[#64748b] shrink-0">
                      {Math.round(item.size_bytes / 1024)} KB
                    </span>
                  </div>
                  <p className="text-[#b45309] font-medium">{item.category}</p>
                  <p className="text-[#475569] line-clamp-2">{item.alt_text}</p>
                </div>
              )}

              <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyUrl(item.id, item.url)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#cbd5e1] hover:bg-[#f8fafc] font-semibold"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-[#16a34a]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>URL</span>
                      </>
                    )}
                  </button>

                  <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#cbd5e1] hover:bg-[#f8fafc] font-semibold cursor-pointer">
                    <RefreshCw className="w-3 h-3" />
                    <span>Replace</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleReplaceImage(item, e)}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditAlt(item.alt_text);
                      setEditDesc(item.description);
                      setEditCat(item.category);
                    }}
                    className="px-2.5 py-1 rounded border border-[#cbd5e1] hover:bg-[#f8fafc] font-semibold"
                  >
                    Edit Info
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  aria-label={`Delete ${item.original_name}`}
                  className="p-1.5 rounded border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
