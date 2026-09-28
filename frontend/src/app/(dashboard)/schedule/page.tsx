"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import { BookAppointmentModal } from "@/components/schedule/BookAppointmentModal";
import { AppointmentDetailModal } from "@/components/schedule/AppointmentDetailModal";
import { usePageHeader } from "@/components/layout/page-header-context";
import {
  dateNav,
  fetchAppointment,
  fetchDailyGrid,
  formatDayLabel,
  toHHMM,
  type Appointment,
  type DailyGrid,
} from "@/lib/schedule";

/**
 * Schedule page — daily appointment grid with date navigation
 * (Previous / Next / Today + calendar picker), booking from OPEN slots,
 * and detail/reschedule/status management on BOOKED cells.
 */

export default function SchedulePage() {
  usePageHeader({
    title: "Schedule",
    actions: (
      <button type="button" className="btn-primary" onClick={() => setBookOpen(true)}>
        + Book Appointment
      </button>
    ),
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => dateNav.toISODate(new Date()));
  const [grid, setGrid] = useState<DailyGrid | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [bookOpen, setBookOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ therapistId?: string; date?: string; startTime?: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadGrid = useCallback(async (date: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setGrid(await fetchDailyGrid(date));
    } catch {
      setLoadError("Could not load the schedule. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGrid(selectedDate);
  }, [selectedDate, loadGrid]);

  // Fetch full appointment details when a BOOKED cell is clicked.
  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetchAppointment(detailId)
      .then((appt) => {
        if (!cancelled) setDetail(appt);
      })
      .catch(() => {
        if (!cancelled) {
          setDetailId(null);
          setLoadError("Could not load that appointment.");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  const shiftDate = (days: number) =>
    setSelectedDate((d) => dateNav.addDays(d, days));

  const openSlot = useCallback(
    (therapistId: string, date: string, startTime: string) => {
      setPrefill({ therapistId, date, startTime });
      setBookOpen(true);
    },
    [],
  );

  const openDetail = useCallback((appointmentId: string) => {
    setDetailId(appointmentId);
  }, []);

  const refreshAfterChange = useCallback(() => {
    loadGrid(selectedDate);
  }, [loadGrid, selectedDate]);

  const onDutyCount = grid?.therapists.filter((t) => t.on_duty).length ?? 0;
  const bookedCount =
    grid?.cells.reduce(
      (n, row) => n + row.filter((c) => c.state === "BOOKED").length,
      0,
    ) ?? 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: date navigation + stats */}
      <Card paddingClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date navigation */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="btn-secondary px-3 py-2"
              onClick={() => shiftDate(-1)}
              aria-label="Previous day"
            >
              ←
            </button>
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setSelectedDate(dateNav.toISODate(new Date()))}>
              Today
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-2"
              onClick={() => shiftDate(1)}
              aria-label="Next day"
            >
              →
            </button>
          </div>

          <input
            type="date"
            className="input-field w-auto font-mono text-sm"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            aria-label="Select date"
          />

          <div className="ml-auto flex items-center gap-2 text-sm text-text-secondary">
            <span className="font-mono">{formatDayLabel(selectedDate)}</span>
            <Badge variant={onDutyCount > 0 ? "success" : "neutral"}>
              {onDutyCount} on duty
            </Badge>
            <Badge variant="neutral" uppercase={false}>
              {bookedCount} booked
            </Badge>
          </div>
        </div>
      </Card>

      {loadError && (
        <div className="rounded-lg border border-status-error-soft bg-status-error-soft px-4 py-3 text-sm text-status-error" role="alert">
          {loadError}
        </div>
      )}

      {/* The grid */}
      {grid && (
        <ScheduleGrid
          grid={grid}
          isLoading={isLoading}
          onOpenSlot={openSlot}
          onOpenAppointment={openDetail}
        />
      )}

      {/* Modals */}
      <BookAppointmentModal
        open={bookOpen}
        onClose={() => {
          setBookOpen(false);
          setPrefill(null);
        }}
        grid={grid}
        prefill={prefill}
        onBooked={refreshAfterChange}
      />

      <AppointmentDetailModal
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        appointment={detail}
        onChanged={refreshAfterChange}
      />
    </div>
  );
}
