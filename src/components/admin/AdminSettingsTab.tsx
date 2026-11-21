import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  KeyRound,
  Save,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import type { MediaAsset, SiteSettings } from '../../types/cms';
import { MediaPickerModal } from './MediaPickerModal';

export interface AdminUserRecord {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'editor';
  createdAt: number;
}

export interface AdminIdentity {
  username: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'editor';
  csrfToken: string;
  twoFactorEnabled?: boolean;
  expiresAt?: number;
}

interface AdminSettingsTabProps {
  settings: SiteSettings;
  media: MediaAsset[];
  currentAdmin: AdminIdentity;
  teamUsers: AdminUserRecord[];
  onMediaUploaded: (item: MediaAsset) => void;
  onSaveSettings: (next: SiteSettings) => Promise<boolean>;
  onRefreshUsers: () => Promise<void>;
  onProfileUpdated: (displayName: string, email: string) => void;
  on2FAChanged?: (enabled: boolean) => void;
  onFullRefresh: () => Promise<void>;
}

export function AdminSettingsTab({
  settings,
  media,
  currentAdmin,
  teamUsers,
  onMediaUploaded,
  onSaveSettings,
  onRefreshUsers,
  onProfileUpdated,
  on2FAChanged,
  onFullRefresh,
}: AdminSettingsTabProps) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [pickerTarget, setPickerTarget] = useState<'logo_url' | 'favicon_url' | null>(null);

  // Own Profile & Password Change
  const [myDisplayName, setMyDisplayName] = useState(currentAdmin.displayName);
  const [myEmail, setMyEmail] = useState(currentAdmin.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  // Two-Factor Authentication (TOTP)
  const [twoFAEnabled, setTwoFAEnabled] = useState(Boolean(currentAdmin.twoFactorEnabled));
  const [tfaSecret, setTfaSecret] = useState('');
  const [tfaUri, setTfaUri] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const [tfaPassword, setTfaPassword] = useState('');
  const [tfaBusy, setTfaBusy] = useState(false);
  const [tfaMsg, setTfaMsg] = useState('');
  const [tfaErr, setTfaErr] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Team RBAC Creation (Admin / Super Admin only)
  const isFullAdmin =
    currentAdmin.role === 'super_admin' || currentAdmin.role === 'admin';
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDisplay, setNewUserDisplay] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'editor' | 'admin'>('editor');
  const [userBusy, setUserBusy] = useState(false);
  const [userMsg, setUserMsg] = useState('');
  const [userErr, setUserErr] = useState('');
  const [confirmDeleteAdminUser, setConfirmDeleteAdminUser] = useState<AdminUserRecord | null>(null);

  // Backup / Restore
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoreErr, setRestoreErr] = useState('');

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg('');
    const ok = await onSaveSettings(form);
    setSavingSettings(false);
    setSettingsMsg(
      ok ? 'Brand, contact, and social settings saved.' : 'Failed to save website settings.'
    );
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileMsg('');
    setProfileErr('');
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': currentAdmin.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          displayName: myDisplayName,
          email: myEmail,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        displayName?: string;
        email?: string;
        passwordChanged?: boolean;
      };
      if (!res.ok) {
        setProfileErr(data.error || 'Could not update profile.');
        return;
      }
      onProfileUpdated(data.displayName || myDisplayName, data.email || myEmail);
      setCurrentPassword('');
      setNewPassword('');
      setProfileMsg(
        data.passwordChanged
          ? 'Profile and password updated. Other sessions revoked.'
          : 'Administrator profile updated.'
      );
    } catch {
      setProfileErr('Network error updating profile.');
    } finally {
      setProfileBusy(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserBusy(true);
    setUserMsg('');
    setUserErr('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': currentAdmin.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          username: newUserUsername,
          email: newUserEmail,
          displayName: newUserDisplay,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setUserErr(data.error || 'Could not create team account.');
        return;
      }
      setNewUserUsername('');
      setNewUserEmail('');
      setNewUserDisplay('');
      setNewUserPassword('');
      setUserMsg('Team account created.');
      await onRefreshUsers();
    } catch {
      setUserErr('Network error creating account.');
    } finally {
      setUserBusy(false);
    }
  };

  const handleDeleteUser = async (id: number, uname: string) => {
    setUserMsg('');
    setUserErr('');
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': currentAdmin.csrfToken },
      credentials: 'include',
    });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setUserErr(d.error || `Failed to remove ${uname}.`);
      return;
    }
    setConfirmDeleteAdminUser(null);
    setUserMsg(`Removed ${uname}.`);
    await onRefreshUsers();
  };

  const handleSetup2FA = async () => {
    setTfaBusy(true);
    setTfaErr('');
    setTfaMsg('');
    try {
      const res = await fetch('/api/admin/2fa/setup', {
        method: 'POST',
        headers: { 'x-csrf-token': currentAdmin.csrfToken },
        credentials: 'include',
      });
      const data = (await res.json()) as {
        secret?: string;
        otpauthUri?: string;
        error?: string;
      };
      if (!res.ok || !data.secret) {
        setTfaErr(data.error || 'Could not generate 2FA secret.');
        return;
      }
      setTfaSecret(data.secret);
      setTfaUri(data.otpauthUri || '');
    } catch {
      setTfaErr('Network error generating 2FA key.');
    } finally {
      setTfaBusy(false);
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTfaBusy(true);
    setTfaErr('');
    setTfaMsg('');
    try {
      const res = await fetch('/api/admin/2fa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': currentAdmin.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ code: tfaCode, currentPassword: tfaPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setTfaErr(data.error || 'Failed to enable 2FA.');
        return;
      }
      setTwoFAEnabled(true);
      setTfaSecret('');
      setTfaUri('');
      setTfaCode('');
      setTfaPassword('');
      setTfaMsg('Two-Factor Authentication (TOTP) is now enabled for your account.');
      on2FAChanged?.(true);
    } catch {
      setTfaErr('Network error enabling 2FA.');
    } finally {
      setTfaBusy(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTfaBusy(true);
    setTfaErr('');
    setTfaMsg('');
    try {
      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': currentAdmin.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: tfaPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setTfaErr(data.error || 'Failed to disable 2FA.');
        return;
      }
      setTwoFAEnabled(false);
      setTfaPassword('');
      setTfaMsg('Two-Factor Authentication has been disabled.');
      on2FAChanged?.(false);
    } catch {
      setTfaErr('Network error disabling 2FA.');
    } finally {
      setTfaBusy(false);
    }
  };

  const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreBusy(true);
    setRestoreMsg('');
    setRestoreErr('');
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': currentAdmin.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(json),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setRestoreErr(data.error || 'Backup restore failed.');
        return;
      }
      setRestoreMsg('CMS backup snapshot restored cleanly.');
      await onFullRefresh();
    } catch {
      setRestoreErr('Invalid JSON snapshot file.');
    } finally {
      setRestoreBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8">
      {/* Brand, Contact & Legal Settings */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#0f172a]">
              Website, Brand &amp; Business Settings
            </h2>
            <p className="text-xs text-[#64748b]">
              Manage brand identity, logo, accent color, public contact info, social channels, and
              analytics.
            </p>
          </div>
          <button
            type="submit"
            disabled={savingSettings}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            <span>{savingSettings ? 'Saving...' : 'Save Website Settings'}</span>
          </button>
        </div>

        {settingsMsg && (
          <div
            role="status"
            className="px-4 py-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#1b4d3e]"
          >
            {settingsMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Brand & Assets */}
          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-[#0f172a]">Brand &amp; Visual Identity</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Brand Name</label>
                <input
                  type="text"
                  value={form.brand_name}
                  onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Brand Accent Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.accent_color}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className="h-10 w-12 rounded border border-[#cbd5e1] bg-white p-1"
                  />
                  <input
                    type="text"
                    value={form.accent_color}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className="flex-1 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#475569] mb-1">Brand Tagline</label>
              <input
                type="text"
                value={form.brand_tagline}
                onChange={(e) => setForm({ ...form, brand_tagline: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#475569] mb-1">Logo Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="Optional custom brand mark"
                  className="flex-1 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                />
                <button
                  type="button"
                  onClick={() => setPickerTarget('logo_url')}
                  className="inline-flex items-center gap-1 h-10 px-3 rounded-lg border border-[#cbd5e1] font-semibold"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Pick</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#475569] mb-1">Favicon Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.favicon_url}
                  onChange={(e) => setForm({ ...form, favicon_url: e.target.value })}
                  placeholder="Optional browser tab icon"
                  className="flex-1 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                />
                <button
                  type="button"
                  onClick={() => setPickerTarget('favicon_url')}
                  className="inline-flex items-center gap-1 h-10 px-3 rounded-lg border border-[#cbd5e1] font-semibold"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Pick</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#475569] mb-1">Footer Copyright Text</label>
              <input
                type="text"
                value={form.footer_copyright}
                onChange={(e) => setForm({ ...form, footer_copyright: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
            </div>
          </div>

          {/* Contact, Social & Legal */}
          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-[#0f172a]">
              Contact, Social Links &amp; Business Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Contact Email</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  WhatsApp Digits (no +)
                </label>
                <input
                  type="text"
                  value={form.whatsapp_number}
                  onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  WhatsApp Display Text
                </label>
                <input
                  type="text"
                  value={form.whatsapp_display}
                  onChange={(e) => setForm({ ...form, whatsapp_display: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Instagram URL</label>
                <input
                  type="text"
                  value={form.instagram_url}
                  onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Instagram Handle</label>
                <input
                  type="text"
                  value={form.instagram_handle}
                  onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">X / Twitter URL</label>
                <input
                  type="text"
                  value={form.twitter_url}
                  onChange={(e) => setForm({ ...form, twitter_url: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">LinkedIn URL</label>
                <input
                  type="text"
                  value={form.linkedin_url}
                  onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Legal Business Name
                </label>
                <input
                  type="text"
                  value={form.business_legal_name}
                  onChange={(e) => setForm({ ...form, business_legal_name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">HQ City</label>
                <input
                  type="text"
                  value={form.business_city}
                  onChange={(e) => setForm({ ...form, business_city: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">HQ Street Address</label>
                <input
                  type="text"
                  value={form.business_address}
                  onChange={(e) => setForm({ ...form, business_address: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  External Analytics ID (GA4 / Plausible)
                </label>
                <input
                  type="text"
                  value={form.analytics_id}
                  onChange={(e) => setForm({ ...form, analytics_id: e.target.value })}
                  placeholder="Optional G-XXXXXXXXXX"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Currency, Bookings & Notification Preferences */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-[#0f172a]">
              Currency &amp; Seat Booking Settings
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Currency Code</label>
                <input
                  type="text"
                  value={form.currency_code}
                  onChange={(e) => setForm({ ...form, currency_code: e.target.value.toUpperCase() })}
                  placeholder="INR"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={form.currency_symbol}
                  onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
                  placeholder="₹"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2.5 font-semibold text-[#0f172a] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={Boolean(form.bookings_enabled)}
                onChange={(e) => setForm({ ...form, bookings_enabled: e.target.checked })}
                className="w-4 h-4 accent-[#1b4d3e]"
              />
              <span>Enable &ldquo;Reserve a Workspace / Seat&rdquo; on public cafe pages</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Advance Lead Time (Hours)
                </label>
                <input
                  type="number"
                  min={0}
                  max={72}
                  value={form.booking_lead_hours}
                  onChange={(e) =>
                    setForm({ ...form, booking_lead_hours: Number(e.target.value) })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Max Seats Per Booking
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.booking_max_guests}
                  onChange={(e) =>
                    setForm({ ...form, booking_max_guests: Number(e.target.value) })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#475569] mb-1">
                Public Booking Policy Note
              </label>
              <input
                type="text"
                value={form.booking_policy_note}
                onChange={(e) => setForm({ ...form, booking_policy_note: e.target.value })}
                placeholder="No prepayment required. Seats held for 20 minutes past slot start."
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
            </div>
          </div>

          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-[#0f172a]">
              Admin Alert &amp; Notification Preferences
            </h3>

            <div>
              <label className="block font-semibold text-[#475569] mb-1">
                Notification Recipient Email
              </label>
              <input
                type="email"
                value={form.notification_email}
                onChange={(e) => setForm({ ...form, notification_email: e.target.value })}
                placeholder="alerts@cafedesk.in"
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center gap-2.5 font-semibold text-[#0f172a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.notify_new_booking)}
                  onChange={(e) => setForm({ ...form, notify_new_booking: e.target.checked })}
                  className="w-4 h-4 accent-[#b45309]"
                />
                <span>Notify on new workspace / seat booking requests</span>
              </label>
              <label className="flex items-center gap-2.5 font-semibold text-[#0f172a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.notify_new_customer)}
                  onChange={(e) => setForm({ ...form, notify_new_customer: e.target.checked })}
                  className="w-4 h-4 accent-[#b45309]"
                />
                <span>Notify on new customer sign-ups</span>
              </label>
              <label className="flex items-center gap-2.5 font-semibold text-[#0f172a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.notify_new_payment)}
                  onChange={(e) => setForm({ ...form, notify_new_payment: e.target.checked })}
                  className="w-4 h-4 accent-[#b45309]"
                />
                <span>Notify on successful subscription payments &amp; refunds</span>
              </label>
              <label className="flex items-center gap-2.5 font-semibold text-[#0f172a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.notify_new_suggestion)}
                  onChange={(e) => setForm({ ...form, notify_new_suggestion: e.target.checked })}
                  className="w-4 h-4 accent-[#b45309]"
                />
                <span>Notify on new cafe suggestions &amp; enquiries</span>
              </label>
            </div>
          </div>
        </div>
      </form>

      {/* Own Account Security & Password Change */}
      <form
        onSubmit={handleUpdateProfile}
        className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
              <span>Your Account &amp; Password ({currentAdmin.username})</span>
            </h3>
            <p className="text-[#64748b]">
              Role:{' '}
              <span className="font-semibold uppercase text-[#0f172a]">
                {currentAdmin.role.replace('_', ' ')}
              </span>
            </p>
          </div>
          <button
            type="submit"
            disabled={profileBusy}
            className="h-10 px-4 rounded-lg bg-[#0f172a] text-white font-semibold"
          >
            {profileBusy ? 'Updating...' : 'Update Profile / Password'}
          </button>
        </div>

        {profileMsg && (
          <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] font-semibold">
            {profileMsg}
          </div>
        )}
        {profileErr && (
          <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] font-semibold">
            {profileErr}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block font-semibold text-[#475569] mb-1">Display Name</label>
            <input
              type="text"
              value={myDisplayName}
              onChange={(e) => setMyDisplayName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">Admin Email</label>
            <input
              type="email"
              value={myEmail}
              onChange={(e) => setMyEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">
              Current Password (if changing)
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#475569] mb-1">
              New Strong Password (optional)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 10 chars, upper, lower & number"
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
            />
          </div>
        </div>
      </form>

      {/* Two-Factor Authentication (Optional TOTP 2FA) */}
      <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
              <span>Two-Factor Authentication (Authenticator App TOTP)</span>
            </h3>
            <p className="text-[#64748b] mt-0.5">
              Optional secondary verification for administrator logins using Google Authenticator, 1Password, or Authy.
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
              twoFAEnabled
                ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#1b4d3e]'
                : 'bg-[#f8fafc] border-[#cbd5e1] text-[#64748b]'
            }`}
          >
            {twoFAEnabled ? '2FA Enabled' : '2FA Optional · Not Enabled'}
          </span>
        </div>

        {tfaMsg && (
          <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] font-semibold">
            {tfaMsg}
          </div>
        )}
        {tfaErr && (
          <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] font-semibold">
            {tfaErr}
          </div>
        )}

        {!twoFAEnabled ? (
          !tfaSecret ? (
            <button
              type="button"
              disabled={tfaBusy}
              onClick={() => void handleSetup2FA()}
              className="h-10 px-4 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white font-semibold"
            >
              {tfaBusy ? 'Generating Secret...' : 'Set Up Two-Factor Authentication'}
            </button>
          ) : (
            <form onSubmit={handleEnable2FA} className="space-y-4 border-t border-[#f1f5f9] pt-4">
              <div className="p-4 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
                <p className="font-semibold text-[#0f172a]">
                  Step 1: Add this setup key to your authenticator app
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="px-3 py-1.5 rounded bg-white border border-[#cbd5e1] font-mono-data text-sm font-bold text-[#0f172a]">
                    {tfaSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(tfaSecret);
                      setCopiedSecret(true);
                      setTimeout(() => setCopiedSecret(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded border border-[#cbd5e1] bg-white font-semibold"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-[#16a34a]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSecret ? 'Copied' : 'Copy Key'}</span>
                  </button>
                </div>
                {tfaUri && (
                  <p className="text-[11px] text-[#64748b] break-all font-mono-data">
                    URI: {tfaUri}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Current Admin Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={tfaPassword}
                    onChange={(e) => setTfaPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    6-Digit Authenticator Code *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={tfaCode}
                    onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={tfaBusy}
                    className="h-10 px-4 rounded-lg bg-[#1b4d3e] text-white font-semibold"
                  >
                    {tfaBusy ? 'Enabling...' : 'Verify & Enable 2FA'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTfaSecret('');
                      setTfaUri('');
                      setTfaCode('');
                      setTfaPassword('');
                    }}
                    className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleDisable2FA} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end border-t border-[#f1f5f9] pt-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#475569] mb-1">
                Confirm Current Password to Disable 2FA
              </label>
              <input
                type="password"
                required
                value={tfaPassword}
                onChange={(e) => setTfaPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
            </div>
            <button
              type="submit"
              disabled={tfaBusy}
              className="h-10 px-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] font-semibold"
            >
              {tfaBusy ? 'Disabling...' : 'Disable 2FA'}
            </button>
          </form>
        )}
      </div>

      {/* Role-Based Team Access & Backup/Restore (Full Admin only) */}
      {isFullAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Team Accounts */}
          <div className="lg:col-span-7 p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#0f172a]">
                Role-Based Admin Team ({teamUsers.length})
              </h3>
            </div>

            {userMsg && (
              <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] font-semibold">
                {userMsg}
              </div>
            )}
            {userErr && (
              <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] font-semibold">
                {userErr}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                required
                placeholder="Username *"
                value={newUserUsername}
                onChange={(e) => setNewUserUsername(e.target.value)}
                className="sm:col-span-3 h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
              <input
                type="email"
                placeholder="Email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="sm:col-span-3 h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
              <input
                type="text"
                placeholder="Display Name"
                value={newUserDisplay}
                onChange={(e) => setNewUserDisplay(e.target.value)}
                className="sm:col-span-3 h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'editor' | 'admin')}
                className="sm:col-span-3 h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <input
                type="password"
                required
                placeholder="Strong Password * (≥10 chars)"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="sm:col-span-8 h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
              <button
                type="submit"
                disabled={userBusy}
                className="sm:col-span-4 h-10 px-3 rounded-lg bg-[#0f172a] text-white font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{userBusy ? 'Adding...' : 'Add Team User'}</span>
              </button>
            </form>

            <div className="divide-y divide-[#f1f5f9]">
              {teamUsers.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#0f172a]">
                      {u.displayName}{' '}
                      <span className="font-mono-data text-[#64748b]">(@{u.username})</span>
                    </p>
                    <p className="text-[11px] text-[#64748b]">
                      {u.email || 'No email'} ·{' '}
                      <span className="uppercase font-semibold text-[#0f172a]">
                        {u.role.replace('_', ' ')}
                      </span>
                    </p>
                  </div>
                  {u.username !== currentAdmin.username && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAdminUser(u)}
                      aria-label={`Remove user ${u.username}`}
                      className="h-8 w-8 rounded border border-[#fecaca] text-[#dc2626] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {confirmDeleteAdminUser && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirm admin user removal"
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
                <h3 className="text-base font-bold text-[#0f172a]">Remove Admin Account?</h3>
                <p className="text-xs text-[#475569]">
                  Remove team access for{' '}
                  <span className="font-semibold text-[#0f172a]">
                    {confirmDeleteAdminUser.displayName} (@{confirmDeleteAdminUser.username})
                  </span>
                  ? They will immediately lose access to the admin dashboard.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAdminUser(null)}
                    className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleDeleteUser(
                        confirmDeleteAdminUser.id,
                        confirmDeleteAdminUser.username
                      )
                    }
                    className="h-9 px-4 rounded-lg bg-[#dc2626] text-white text-xs font-semibold"
                  >
                    Remove Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Backup & Recovery */}
          <div className="lg:col-span-5 p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-[#0f172a]">
              Database Backup &amp; Restore
            </h3>
            <p className="text-[#475569] leading-relaxed">
              Export a complete JSON snapshot of locations, homepage sections, content blocks,
              navigation links, and settings, or restore a saved backup transactionally.
            </p>

            {restoreMsg && (
              <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] font-semibold">
                {restoreMsg}
              </div>
            )}
            {restoreErr && (
              <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] font-semibold">
                {restoreErr}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <a
                href="/api/admin/backup"
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg bg-[#0f172a] text-white font-semibold"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Download Full CMS Backup (.json)</span>
              </a>

              <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#0f172a] font-semibold cursor-pointer">
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>{restoreBusy ? 'Restoring...' : 'Restore from JSON Backup'}</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreUpload}
                  disabled={restoreBusy}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <MediaPickerModal
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        media={media}
        csrfToken={currentAdmin.csrfToken}
        onMediaUploaded={onMediaUploaded}
        defaultCategory="Brand Assets"
        title={
          pickerTarget === 'logo_url'
            ? 'Select Custom Brand Logo'
            : 'Select Website Favicon'
        }
        onSelect={(url) => {
          if (!pickerTarget) return;
          setForm({ ...form, [pickerTarget]: url });
        }}
      />
    </div>
  );
}
