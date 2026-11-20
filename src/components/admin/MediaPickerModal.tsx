import React, { useState } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import type { MediaAsset } from '../../types/cms';

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, altText?: string) => void;
  media: MediaAsset[];
  csrfToken: string;
  onMediaUploaded: (item: MediaAsset) => void;
  defaultCategory?: string;
  title?: string;
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  media,
  csrfToken,
  onMediaUploaded,
  defaultCategory = 'Branch Photos',
  title = 'Select or Upload Image',
}: MediaPickerModalProps) {
  const [filterCat, setFilterCat] = useState('All');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [altText, setAltText] = useState('');

  if (!open) return null;

  const categories = ['All', ...Array.from(new Set(media.map((m) => m.category || 'General')))];
  const visibleItems =
    filterCat === 'All' ? media : media.filter((m) => (m.category || 'General') === filterCat);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setUploadError('Only PNG, JPEG, or WebP images are supported.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Please choose an image smaller than 4 MB.');
      return;
    }

    setUploadError('');
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/admin/media', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({
            dataUrl: String(reader.result ?? ''),
            fileName: file.name,
            altText: altText.trim() || file.name.replace(/\.[^.]+$/, ''),
            category: defaultCategory,
          }),
        });
        const data = (await res.json()) as { item?: MediaAsset; error?: string };
        if (!res.ok || !data.item) {
          setUploadError(data.error || 'Upload failed.');
          return;
        }
        onMediaUploaded(data.item);
        onSelect(data.item.url, data.item.alt_text);
        onClose();
      } catch {
        setUploadError('Network error uploading image.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#b45309]" aria-hidden="true" />
            <h2 className="font-semibold text-base text-[#0f172a]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image picker"
            className="w-9 h-9 rounded-lg border border-[#e2e8f0] flex items-center justify-center text-[#475569] hover:text-[#0f172a]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload Bar */}
        <div className="px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Descriptive alt text for new upload..."
            className="flex-1 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white text-sm"
          />
          <label className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold cursor-pointer whitespace-nowrap">
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>{uploading ? 'Uploading...' : 'Upload New Photo'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              className="sr-only"
            />
          </label>
        </div>

        {uploadError && (
          <p role="alert" className="px-6 py-2 bg-[#fef2f2] text-xs font-semibold text-[#b91c1c]">
            {uploadError}
          </p>
        )}

        {/* Folder Filter */}
        <div className="px-6 py-3 border-b border-[#e2e8f0] flex items-center gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
                filterCat === cat
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-[#f1f5f9] text-[#475569] hover:text-[#0f172a]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Image Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item.url, item.alt_text);
                onClose();
              }}
              className="group text-left rounded-xl border border-[#e2e8f0] hover:border-[#b45309] overflow-hidden bg-white flex flex-col transition-colors"
            >
              <div className="aspect-[4/3] w-full bg-[#f1f5f9] overflow-hidden">
                <img
                  src={item.url}
                  alt={item.alt_text}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-[#0f172a] truncate">{item.original_name}</p>
                <p className="text-[11px] text-[#64748b] truncate">{item.category}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
