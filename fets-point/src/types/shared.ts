import { Database } from './database.types';

export type StaffProfile = Database['public']['Tables']['staff_profiles']['Row'] & {
  id: string;
  user_id: string;
  full_name: string;
  is_active?: boolean | null;
  employment_end_date?: string | null;
  avatar_url?: string | null;
  branch_assigned?: string | null;
  role?: string;
  contact_number?: string;
  position?: string;
  joining_date?: string;
  certificates?: any[];
  trainings_attended?: any[];
  future_trainings?: any[];
  remarks?: string;
};
export type RosterSchedule = Database['public']['Tables']['roster_schedules']['Row'];
export type LeaveRequest = Database['public']['Tables']['leave_requests']['Row'] & { requestor_name?: string; target_name?: string; };
export type Notification = any; // Database['public']['Tables']['notifications']['Row'];
export type ChecklistItem = any; // Database['public']['Tables']['checklist_items']['Row'];
export type CandidateMetrics = { total: number; present: number; absent: number; };
export type IncidentStats = { open: number; closed: number; critical: number; };

export type QuestionType = 'checkbox' | 'text' | 'number' | 'dropdown' | 'radio' | 'textarea' | 'date';
export type ChecklistPriority = 'low' | 'medium' | 'high';

export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string | null;
  is_deleted?: boolean | null;
  is_edited?: boolean | null;
  author?: StaffProfile;
  read_receipts?: Array<{ user_id: string; read_at: string | null }>;
}

export interface Conversation {
  id: string;
  created_by: string;
  name?: string | null;
  is_group?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  members?: ConversationMember[];
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  is_admin?: boolean | null;
  is_muted?: boolean | null;
  joined_at?: string | null;
  last_read_at?: string | null;
}

// Shared types for FETS application

export interface Schedule {
  id?: string
  profile_id: string
  date: string
  shift_code: string
  overtime_hours?: number
  status: string
  created_at?: string
  updated_at?: string
}

export interface Session {
  id: number
  created_at?: string
  date: string
  start_time: string
  end_time: string
  client_name: string
  candidate_count: number
  exam_name: string
  user_id: string
  branch?: string
  branch_location?: string
  status?: string
}

export interface Event {
  id: string
  title: string
  description?: string
  event_date: string
  priority: 'critical' | 'major' | 'minor'
  status?: string
  category?: string
  assigned_to?: string
  reporter_id?: string
  branch_location?: string
  closed_at?: string
  closure_remarks?: string
  created_at?: string
  updated_at?: string
}

export interface Incident {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status?: string
  category?: string
  assigned_to?: string
  reporter: string
  user_id: string
  branch_location?: string
  due_date?: string
  completed_at?: string
  created_at?: string
  updated_at?: string
}

export interface Comment {
  id: string
  body: string
  author_id: string
  author_full_name: string
  incident_id: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description?: string
  assigned_to: string
  assigned_by: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority?: string
  due_date?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface KPIData {
  sessions_scheduled: number
  sessions_live: number
  sessions_done: number
  candidates_present: number
  candidates_expected: number
  incidents_open: number
}

export type BranchType = 'global' | string

export type UserSettings = any; // Database['public']['Tables']['user_settings']['Row'];
export type NewsTicker = any; // Database['public']['Tables']['news_ticker']['Row'];

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  title: string;
  description?: string | null;
  priority?: ChecklistPriority | null;
  question_type?: QuestionType | null;
  dropdown_options?: string[] | null;
  is_required?: boolean | null;
  estimated_time_minutes?: number | null;
  responsible_role?: string | null;
  sort_order?: number | null;
  created_at: string;
}

export const PRIORITY_LEVELS = {
  'low': { label: 'Low', color: 'bg-blue-100 text-blue-700', value: 'low' },
  'medium': { label: 'Medium', color: 'bg-yellow-100 text-yellow-700', value: 'medium' },
  'high': { label: 'High', color: 'bg-red-100 text-red-700', value: 'high' }
} as const

export type PriorityLevel = keyof typeof PRIORITY_LEVELS

// Apple-inspired shift color scheme
export const SHIFT_CODES = {
  'D': {
    name: 'Day Shift',
    bgColor: 'linear-gradient(135deg, #007AFF 0%, #5AC8FA 100%)', // Apple Blue
    textColor: '#ffffff',
    borderColor: '#007AFF',
    letter: 'D'
  },
  'E': {
    name: 'Evening Shift',
    bgColor: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)', // Apple Green
    textColor: '#ffffff',
    borderColor: '#34C759',
    letter: 'E'
  },
  'HD': {
    name: 'Half Day',
    bgColor: 'linear-gradient(135deg, #FF9500 0%, #FFCC02 100%)', // Apple Orange
    textColor: '#ffffff',
    borderColor: '#FF9500',
    letter: 'HD'
  },
  'RD': {
    name: 'Rest Day',
    bgColor: 'linear-gradient(135deg, #F2F2F7 0%, #E5E5EA 100%)', // Apple Light Gray
    textColor: '#1D1D1F',
    borderColor: '#D1D1D6',
    letter: 'RD'
  },
  'L': {
    name: 'Leave',
    bgColor: 'linear-gradient(135deg, #FF3B30 0%, #FF6961 100%)', // Apple Red
    textColor: '#ffffff',
    borderColor: '#FF3B30',
    letter: 'L'
  },
  'OT': {
    name: 'Overtime',
    bgColor: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 100%)', // Pink for OT combinations
    textColor: '#ffffff',
    borderColor: '#FF69B4',
    letter: 'OT'
  },
  'T': {
    name: 'Training',
    bgColor: 'linear-gradient(135deg, #8E8E93 0%, #AEAEB2 100%)', // Apple Gray
    textColor: '#ffffff',
    borderColor: '#8E8E93',
    letter: 'T'
  },
  'TOIL': {
    name: 'Time Off In Lieu',
    bgColor: 'linear-gradient(135deg, #AF52DE 0%, #C644FC 100%)', // Apple Purple
    textColor: '#ffffff',
    borderColor: '#AF52DE',
    letter: 'TOIL'
  },
  'PH': {
    name: 'Public Holiday',
    bgColor: 'linear-gradient(135deg, #FF3B30 0%, #FF6961 100%)',
    textColor: '#ffffff',
    borderColor: '#FF3B30',
    letter: 'PH'
  },
  'TRD': {
    name: 'TOIL Rest Day',
    bgColor: 'linear-gradient(135deg, #AF52DE 0%, #C644FC 100%)',
    textColor: '#ffffff',
    borderColor: '#AF52DE',
    letter: 'TRD'
  }
} as const

export type ShiftCode = keyof typeof SHIFT_CODES
export type ViewMode = 'week' | '2weeks' | 'month'
