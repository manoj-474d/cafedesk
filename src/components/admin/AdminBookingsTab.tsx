import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { LocationItem } from '../../types/cms';
import type {
  BookingPaymentStatus,
  BookingRecord,
  BookingStatus,
} from '../../types/subscription';

interface AdminBookingsTabProps {
  bookings: BookingRecord[];
  locations: LocationItem[];
  csrfToken: string;
  onRefreshBookings: () => Promise<void>;
}

const WORKSPACE_OPTIONS = [
  'Laptop Desk',
  'Quiet Study Zone',
  'Meeting Booth',
  'Casual & Budget Seating',
  'Window Bar Counter',
  'Outdoor Patio',
];

const TIME_SLOTS = [
  '09:00 AM - 12:00 PM',
  '12:00 PM - 03:00 PM',
  '03:00 PM - 06:00 PM',
  '06:00 PM - 09:00 PM',
  'Full Day (09:00 AM - 07:00 PM)',
];

function getStatusBadgeClass(status: BookingStatus): string {
  switch (status) {
    case 'confirmed':
      return 'bg-[#ecfdf5] border-[#a7f3d0] text-[#1b4d3e]';
    case 'completed':
      return 'bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]';
    case 'cancelled':
      return 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]';
    default:
      return 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]';
  }
}

export function AdminBookingsTab({
  bookings,
  locations,
  csrfToken,
  onRefreshBookings,
}: AdminBookingsTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [cafeFilter, setCafeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const [busyId, setBusyId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [detailBooking, setDetailBooking] = useState<BookingRecord | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingRecord | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleWorkspace, setRescheduleWorkspace] = useState('');
  const [rescheduleGuests, setRescheduleGuests] = useState(1);
  const [rescheduleAmount, setRescheduleAmount] = useState(0);
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<BookingRecord | null>(null);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const kpis = useMemo(() => {
    const total = bookings.length;
    const todayCount = bookings.filter((b) => b.booking_date === todayIso).length;
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const confirmed = bookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'completed'
    ).length;
    return { total, todayCount, pending, confirmed };
  }, [bookings, todayIso]);

  const cafeFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    locations.forEach((l) => seen.set(l.id, l.name));
    bookings.forEach((b) => {
      if (!seen.has(b.cafe_id)) seen.set(b.cafe_id, b.cafe_name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [locations, bookings]);

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (cafeFilter !== 'all' && b.cafe_id !== cafeFilter && b.cafe_name !== cafeFilter) {
        return false;
      }
      if (dateFilter && b.booking_date !== dateFilter) return false;
      if (!q) return true;
      return `${b.booking_ref} ${b.customer_name} ${b.customer_email} ${b.customer_phone} ${b.cafe_name} ${b.workspace_type}`
        .toLowerCase()
        .includes(q);
    });
  }, [bookings, search, statusFilter, cafeFilter, dateFilter]);

  const patchBooking = async (
    bookingId: number,
    payload: Partial<{
      status: BookingStatus;
      payment_status: BookingPaymentStatus;
      booking_date: string;
      time_slot: string;
      workspace_type: string;
      guests_count: number;
      amount_inr: number;
      notes: string;
    }>,
    successText: string
  ) => {
    setBusyId(bookingId);
    setNotice('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not update booking.');
        return false;
      }
      setNotice(successText);
      await onRefreshBookings();
      return true;
    } finally {
      setBusyId(null);
    }
  };

  const openRescheduleModal = (b: BookingRecord) => {
    setRescheduleBooking(b);
    setRescheduleDate(b.booking_date);
    setRescheduleSlot(b.time_slot);
    setRescheduleWorkspace(b.workspace_type);
    setRescheduleGuests(b.guests_count);
    setRescheduleAmount(b.amount_inr);
    setRescheduleNotes(b.notes);
  };

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking) return;
    setSavingReschedule(true);
    const ok = await patchBooking(
      rescheduleBooking.id,
      {
        booking_date: rescheduleDate,
        time_slot: rescheduleSlot,
        workspace_type: rescheduleWorkspace,
        guests_count: Number(rescheduleGuests),
        amount_inr: Number(rescheduleAmount),
        notes: rescheduleNotes,
      },
      `Updated booking ${rescheduleBooking.booking_ref} (${rescheduleDate} · ${rescheduleSlot}).`
    );
    setSavingReschedule(false);
    if (ok) setRescheduleBooking(null);
  };

  const handleDeleteBooking = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setBusyId(target.id);
    setConfirmDelete(null);
    setNotice('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/bookings/${target.id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include',
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(d.error || 'Failed to delete booking.');
        return;
      }
      setNotice(`Deleted booking ${target.booking_ref}.`);
      await onRefreshBookings();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0f172a]">Workspace &amp; Seat Bookings</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Manage cafe seat reservations, confirm or reschedule time slots, track payment status, and export CSV records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/bookings/export"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#0f172a] text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>
          <button
            type="button"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await onRefreshBookings();
              setRefreshing(false);
            }}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#1b4d3e] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#991b1b] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Total Bookings</span>
            <CalendarCheck className="w-4 h-4 text-[#0f172a]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            {kpis.total}
          </p>
        </div>
        <div className="p-4 sm:p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Today&apos;s Bookings</span>
            <CalendarClock className="w-4 h-4 text-[#b45309]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#b45309]">
            {kpis.todayCount}
          </p>
        </div>
        <div className="p-4 sm:p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Pending Review</span>
            <ShieldAlert className="w-4 h-4 text-[#d97706]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#d97706]">
            {kpis.pending}
          </p>
        </div>
        <div className="p-4 sm:p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Confirmed / Completed</span>
            <CheckCircle2 className="w-4 h-4 text-[#1b4d3e]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#1b4d3e]">
            {kpis.confirmed}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ref, customer, email, phone, cafe..."
            className="w-full h-11 pl-9 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
          />
        </div>

        <select
          aria-label="Filter by booking status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | BookingStatus)}
          className="h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Statuses ({bookings.length})</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          aria-label="Filter by cafe"
          value={cafeFilter}
          onChange={(e) => setCafeFilter(e.target.value)}
          className="h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Cafes</option>
          {cafeFilterOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            type="date"
            aria-label="Filter by booking date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex-1 h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-mono-data"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="min-h-[44px] px-3 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#475569]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bookings List: Desktop Table + Mobile Cards */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CalendarCheck className="w-7 h-7 text-[#b45309] mx-auto" />
            <p className="text-sm font-semibold text-[#0f172a]">No bookings found</p>
            <p className="text-xs text-[#64748b]">
              Bookings created on cafe detail pages appear here in real time.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] font-semibold">
                    <th className="py-3 px-4">Booking Ref</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Cafe &amp; Workspace</th>
                    <th className="py-3 px-4">Date &amp; Time Slot</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-[#f8fafc]">
                      <td className="py-3 px-4 font-mono-data font-bold text-[#0f172a] whitespace-nowrap">
                        {b.booking_ref}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#0f172a]">{b.customer_name}</p>
                        <p className="text-[#64748b]">
                          {b.customer_email || b.customer_phone || 'No contact'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#0f172a]">{b.cafe_name}</p>
                        <p className="text-[#64748b]">
                          {b.workspace_type} · {b.guests_count} seat{b.guests_count > 1 ? 's' : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono-data text-[#334155] whitespace-nowrap">
                        <p className="font-semibold">{b.booking_date}</p>
                        <p className="text-[11px] text-[#64748b]">{b.time_slot}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          aria-label={`Payment status for ${b.booking_ref}`}
                          disabled={busyId === b.id}
                          value={b.payment_status}
                          onChange={(e) =>
                            void patchBooking(
                              b.id,
                              { payment_status: e.target.value as BookingPaymentStatus },
                              `Updated payment status for ${b.booking_ref}.`
                            )
                          }
                          className="h-9 px-2 rounded border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
                        >
                          <option value="pay_at_cafe">Pay at Cafe</option>
                          <option value="unpaid">Unpaid</option>
                          <option value="paid">Paid</option>
                          <option value="refunded">Refunded</option>
                        </select>
                        {b.amount_inr > 0 && (
                          <p className="font-mono-data text-[11px] text-[#475569] mt-0.5">
                            ₹{b.amount_inr}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${getStatusBadgeClass(
                            b.status
                          )}`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {b.status !== 'confirmed' && b.status !== 'completed' && (
                            <button
                              type="button"
                              disabled={busyId === b.id}
                              onClick={() =>
                                void patchBooking(
                                  b.id,
                                  { status: 'confirmed' },
                                  `Confirmed booking ${b.booking_ref}.`
                                )
                              }
                              className="px-2.5 py-1.5 rounded bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] font-semibold hover:bg-[#d1fae5]"
                            >
                              Confirm
                            </button>
                          )}
                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              disabled={busyId === b.id}
                              onClick={() =>
                                void patchBooking(
                                  b.id,
                                  { status: 'completed' },
                                  `Marked booking ${b.booking_ref} completed.`
                                )
                              }
                              className="px-2.5 py-1.5 rounded bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8] font-semibold hover:bg-[#dbeafe]"
                            >
                              Complete
                            </button>
                          )}
                          {b.status !== 'cancelled' && (
                            <button
                              type="button"
                              disabled={busyId === b.id}
                              onClick={() =>
                                void patchBooking(
                                  b.id,
                                  { status: 'cancelled' },
                                  `Cancelled booking ${b.booking_ref}.`
                                )
                              }
                              className="px-2.5 py-1.5 rounded bg-white border border-[#fecaca] text-[#dc2626] font-semibold hover:bg-[#fef2f2]"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openRescheduleModal(b)}
                            className="px-2.5 py-1.5 rounded border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#0f172a] font-semibold"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetailBooking(b)}
                            aria-label={`View booking ${b.booking_ref}`}
                            className="p-1.5 rounded border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#475569]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(b)}
                            aria-label={`Delete booking ${b.booking_ref}`}
                            className="p-1.5 rounded border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-[#e2e8f0]">
              {filteredBookings.map((b) => (
                <div key={b.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono-data font-bold text-[#0f172a]">
                        {b.booking_ref}
                      </span>
                      <p className="text-sm font-bold text-[#0f172a] mt-0.5">{b.cafe_name}</p>
                      <p className="text-[#64748b]">
                        {b.workspace_type} · {b.guests_count} seat{b.guests_count > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold capitalize shrink-0 ${getStatusBadgeClass(
                        b.status
                      )}`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
                    <p className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#64748b]" />
                      <span>{b.customer_name}</span>
                    </p>
                    <p className="text-[#475569]">
                      {b.customer_email || '—'} {b.customer_phone ? `· ${b.customer_phone}` : ''}
                    </p>
                    <p className="font-mono-data text-[#0f172a] font-semibold">
                      {b.booking_date} · {b.time_slot}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[#475569] font-semibold">Payment</label>
                    <select
                      aria-label={`Payment status for ${b.booking_ref}`}
                      disabled={busyId === b.id}
                      value={b.payment_status}
                      onChange={(e) =>
                        void patchBooking(
                          b.id,
                          { payment_status: e.target.value as BookingPaymentStatus },
                          `Updated payment status for ${b.booking_ref}.`
                        )
                      }
                      className="h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
                    >
                      <option value="pay_at_cafe">Pay at Cafe</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {b.status !== 'confirmed' && b.status !== 'completed' && (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() =>
                          void patchBooking(
                            b.id,
                            { status: 'confirmed' },
                            `Confirmed booking ${b.booking_ref}.`
                          )
                        }
                        className="min-h-[44px] px-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] font-semibold"
                      >
                        Confirm
                      </button>
                    )}
                    {b.status === 'confirmed' && (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() =>
                          void patchBooking(
                            b.id,
                            { status: 'completed' },
                            `Marked booking ${b.booking_ref} completed.`
                          )
                        }
                        className="min-h-[44px] px-3 rounded-lg bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8] font-semibold"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openRescheduleModal(b)}
                      className="min-h-[44px] px-3 rounded-lg border border-[#cbd5e1] bg-white font-semibold text-[#0f172a]"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailBooking(b)}
                      className="min-h-[44px] px-3 rounded-lg border border-[#cbd5e1] bg-white font-semibold text-[#475569]"
                    >
                      Details
                    </button>
                    {b.status !== 'cancelled' ? (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() =>
                          void patchBooking(
                            b.id,
                            { status: 'cancelled' },
                            `Cancelled booking ${b.booking_ref}.`
                          )
                        }
                        className="min-h-[44px] px-3 rounded-lg border border-[#fecaca] text-[#dc2626] font-semibold"
                      >
                        Cancel Booking
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(b)}
                        className="min-h-[44px] px-3 rounded-lg border border-[#fecaca] text-[#dc2626] font-semibold"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Reschedule / Edit Booking Modal */}
      {rescheduleBooking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reschedule booking"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveReschedule}
            className="bg-white rounded-2xl border border-[#e2e8f0] max-w-lg w-full overflow-hidden shadow-xl"
          >
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0f172a]">
                  Reschedule / Edit Booking {rescheduleBooking.booking_ref}
                </h3>
                <p className="text-xs text-[#64748b]">
                  {rescheduleBooking.cafe_name} · {rescheduleBooking.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleBooking(null)}
                aria-label="Close reschedule modal"
                className="w-9 h-9 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Booking Date *</label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Time Slot *</label>
                  <select
                    value={rescheduleSlot}
                    onChange={(e) => setRescheduleSlot(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  >
                    {!TIME_SLOTS.includes(rescheduleSlot) && rescheduleSlot && (
                      <option value={rescheduleSlot}>{rescheduleSlot}</option>
                    )}
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block font-semibold text-[#475569] mb-1">Workspace Type</label>
                  <select
                    value={rescheduleWorkspace}
                    onChange={(e) => setRescheduleWorkspace(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  >
                    {!WORKSPACE_OPTIONS.includes(rescheduleWorkspace) && rescheduleWorkspace && (
                      <option value={rescheduleWorkspace}>{rescheduleWorkspace}</option>
                    )}
                    {WORKSPACE_OPTIONS.map((ws) => (
                      <option key={ws} value={ws}>
                        {ws}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Seats / Guests</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={rescheduleGuests}
                    onChange={(e) => setRescheduleGuests(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Amount (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={rescheduleAmount}
                    onChange={(e) => setRescheduleAmount(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">Admin / Desk Notes</label>
                <textarea
                  rows={3}
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  placeholder="Optional seating preference or desk confirmation note..."
                  className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduleBooking(null)}
                className="min-h-[44px] px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingReschedule}
                className="min-h-[44px] px-5 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
              >
                {savingReschedule ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customer & Booking Detail Modal */}
      {detailBooking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Booking details"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-lg w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0f172a]">
                  Booking {detailBooking.booking_ref}
                </h3>
                <p className="text-xs text-[#64748b]">{detailBooking.cafe_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailBooking(null)}
                aria-label="Close booking details"
                className="w-9 h-9 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Customer Name</p>
                  <p className="font-semibold text-[#0f172a] mt-0.5">{detailBooking.customer_name}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Status</p>
                  <p className="font-semibold capitalize text-[#0f172a] mt-0.5">
                    {detailBooking.status} · {detailBooking.payment_status.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Email</p>
                  <p className="font-medium text-[#0f172a] mt-0.5 break-all">
                    {detailBooking.customer_email || '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Phone</p>
                  <p className="font-mono-data text-[#0f172a] mt-0.5">
                    {detailBooking.customer_phone || '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Schedule</p>
                  <p className="font-mono-data font-semibold text-[#0f172a] mt-0.5">
                    {detailBooking.booking_date} · {detailBooking.time_slot}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Workspace &amp; Seats</p>
                  <p className="font-semibold text-[#0f172a] mt-0.5">
                    {detailBooking.workspace_type} ({detailBooking.guests_count})
                  </p>
                </div>
              </div>

              {detailBooking.notes && (
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b] font-semibold mb-1">Customer Notes</p>
                  <p className="text-[#0f172a] leading-relaxed">{detailBooking.notes}</p>
                </div>
              )}

              <p className="text-[11px] font-mono-data text-[#64748b]">
                Created: {new Date(detailBooking.created_at).toLocaleString('en-IN')}
              </p>
            </div>

            <div className="px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end gap-2">
              {detailBooking.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await patchBooking(
                      detailBooking.id,
                      { status: 'cancelled' },
                      `Cancelled booking ${detailBooking.booking_ref}.`
                    );
                    if (ok) setDetailBooking(null);
                  }}
                  className="min-h-[44px] px-4 rounded-lg border border-[#fecaca] text-[#dc2626] text-xs font-semibold inline-flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Booking</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailBooking(null)}
                className="min-h-[44px] px-4 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete booking"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a]">Delete Booking Record?</h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              Permanently remove booking{' '}
              <span className="font-mono-data font-bold text-[#0f172a]">
                {confirmDelete.booking_ref}
              </span>{' '}
              by <strong>{confirmDelete.customer_name}</strong> at{' '}
              <strong>{confirmDelete.cafe_name}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="min-h-[44px] px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteBooking()}
                className="min-h-[44px] px-4 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold"
              >
                Delete Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
