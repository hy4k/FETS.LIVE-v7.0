import type { SeatBranch, SeatContext, SeatSession } from '../seats/types';

export type InsightRange = {
  startMonth: string; endMonth: string; from: string; through: string;
  previousFrom: string; previousThrough: string; label: string; previousLabel: string;
};
export type InsightVolume = {
  candidates: number; sessionCount: number; bookedDays: number; providerCount: number;
  upcomingCandidates: number; cancelledSessions: number; invalidCounts: number;
  unassignedCentres: number; invalidDates: number; conflictingIds: number[]; complete: boolean;
};
export type InsightProvider = {
  /** share is 0..1; change is an absolute candidate-count delta, never a percentage. */
  name: string; candidates: number; sessionCount: number; share: number;
  previousCandidates: number | null; change: number | null;
};
export type InsightCritical = {
  date: string; start: number; end: number; booked: number; capacity: number;
};
export type InsightCentre = {
  branch: SeatBranch; label: string; candidates: number; sessionCount: number;
  bookedDays: number; overbookedDays: number; fullDays: number; incompleteDays: number;
  critical: InsightCritical | null; seatHours: number | null;
};
export type InsightDay = {
  date: string; candidates: number; sessionCount: number;
  status: 'overbooked' | 'full' | 'incomplete' | 'unavailable' | 'no_bookings' | 'scheduled';
};
export type InsightAttention = {
  id: string; date: string; branch: SeatBranch;
  kind: 'overbooked' | 'full' | 'incomplete'; title: string; detail: string;
  start: number | null; end: number | null; booked: number | null;
  capacity: number | null; excess: number | null;
};
export type CalendarInsightsModel = {
  volume: InsightVolume; previous: InsightVolume | null; providers: InsightProvider[];
  centres: InsightCentre[]; days: InsightDay[]; attention: InsightAttention[];
  qualityNotes: string[]; capacityAvailable: boolean;
};
export type InsightData = {
  sessions: SeatSession[]; previousSessions: SeatSession[] | null; context: SeatContext | null;
  previousError: string | null; seatError: string | null;
};
export type CalendarInsightsInput = {
  sessions: SeatSession[]; previousSessions: SeatSession[] | null; context: SeatContext | null;
  range: InsightRange; branch: string; today: string;
};
