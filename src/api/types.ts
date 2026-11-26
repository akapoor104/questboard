// Shared types for the Questboard API. These mirror the JSON returned by the
// SQL functions in db/migrations and by the in-memory demo backend.
//
// Conventions: ids are UUID strings; dates are 'YYYY-MM-DD'; clock times are
// minutes from midnight (540 = 9:00); timestamps are ISO strings.

export type Role = 'parent' | 'kid' | 'display' | 'none';
export type CardKind = 'must' | 'choice';
export type CardPlace = 'day' | 'week' | 'tray';
export type CardStatus = 'open' | 'resolved' | 'dropped';
export type CreatedBy = 'parent' | 'kid' | 'system';
export type Remainder = 'tray' | 'day' | 'let_go';

export interface ChildSummary {
  id: string;
  name: string;
  avatar: string;
  theme: string;
  pin_set?: boolean;
}

export interface DeviceInfo {
  status: 'pending' | 'approved' | 'revoked';
  kind: 'kid' | 'display';
  label: string | null;
  child_id: string | null;
  unlocked: boolean;
  pair_code: string | null;
  pair_expires_at: string | null;
}

export interface WhoAmI {
  role: Role;
  email: string | null;
  device: DeviceInfo | null;
  can_claim_parent: boolean;
  family_name: string | null;
  timezone: string;
  day_start_min: number;
  day_end_min: number;
  today: string;
  now: string;
  children: ChildSummary[];
}

export interface PairingInfo {
  status: 'pending' | 'approved';
  pair_code: string | null;
  pair_expires_at: string | null;
}

export interface DeviceRow {
  user_id: string;
  label: string | null;
  kind: 'kid' | 'display';
  status: 'pending' | 'approved' | 'revoked';
  child_id: string | null;
  approved_at: string | null;
  created_at: string;
  unlocked: boolean;
}

export interface UnlockResult {
  ok: boolean;
  unlocked_until?: string;
  attempts_left?: number;
  locked_until?: string | null;
}

export interface Settings {
  family_name: string;
  timezone: string;
  day_start_min: number;
  day_end_min: number;
  children: ChildSummary[];
  // Parents only:
  parent_emails?: string[];
  unlock_minutes?: number;
  catchup_alert_threshold?: number;
  structured_weekly_max_min?: number;
  automation_token_set?: boolean;
  parents?: { email: string; display_name: string | null }[];
}

export type SettingsPatch = Partial<
  Pick<
    Settings,
    | 'family_name'
    | 'timezone'
    | 'day_start_min'
    | 'day_end_min'
    | 'parent_emails'
    | 'unlock_minutes'
    | 'catchup_alert_threshold'
    | 'structured_weekly_max_min'
  >
>;

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  kind: 'structured' | 'free';
  sort: number;
  active: boolean;
}

export interface LibraryItem {
  id: string;
  title: string;
  category_id: string;
  minutes: number;
  description: string | null;
  tags: string[];
  source: 'guide' | 'parent' | 'kid';
  plan_ref: string | null;
  active: boolean;
  created_at: string;
}

export interface Library {
  categories: Category[];
  items: LibraryItem[];
}

export interface Card {
  id: string;
  child_id: string;
  title: string;
  category_id: string;
  minutes: number;
  kind: CardKind;
  created_by: CreatedBy;
  place: CardPlace;
  date: string | null;
  start_min: number | null;
  week_start: string | null;
  due_date: string | null;
  status: CardStatus;
  pct: number | null;
  resolved_at: string | null;
  note: string | null;
  doing_since: string | null;
  drop_requested_at: string | null;
  drop_reason: string | null;
  root_id: string;
  carried_from_id: string | null;
  library_item_id: string | null;
  goal_id: string | null;
  details: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
  seq: number;
}

/** Fields accepted when creating a card. Kids always create 'choice' cards. */
export interface NewCard {
  title: string;
  category_id: string;
  minutes: number;
  place: 'day' | 'week';
  date?: string | null;
  start_min?: number | null;
  week_start?: string | null;
  kind?: CardKind;
  due_date?: string | null;
  details?: string | null;
  library_item_id?: string | null;
  goal_id?: string | null;
  sort?: number;
}

export type CardPatch = Partial<
  Pick<Card, 'title' | 'category_id' | 'minutes' | 'kind' | 'details' | 'due_date' | 'goal_id'>
>;

export interface Goal {
  id: string;
  child_id: string;
  scope: 'week' | 'month';
  period_start: string;
  title: string;
  category_id: string | null;
  note: string | null;
  status: 'active' | 'done' | 'dropped';
  sort: number;
  created_by: CreatedBy;
  created_at: string;
  seq: number;
}

export interface GoalInput {
  id?: string;
  scope?: 'week' | 'month';
  period_start?: string;
  title?: string;
  category_id?: string | null;
  note?: string | null;
  status?: 'active' | 'done' | 'dropped';
  sort?: number;
}

export interface DayMark {
  child_id: string;
  date: string;
  kind: 'away' | 'rest';
  note: string | null;
}

export interface Closeout {
  child_id: string;
  date: string;
  closed_at: string;
  mood: number | null;
  note: string | null;
}

export interface Board {
  from: string;
  to: string;
  today: string;
  now: string;
  /** Cards placed on a day inside the range (dropped cards excluded). */
  cards: Card[];
  /** Open cards planned for "any day this week", for weeks touching the range. */
  pool: Card[];
  /** Open carry-over cards waiting in the Catch-up tray. */
  tray: Card[];
  /** Open cards on any past day: he still has to say how much he did. */
  unconfirmed: Card[];
  /** Open must-do cards he has asked to drop. */
  drop_requests: Card[];
  goals: Goal[];
  day_marks: DayMark[];
  closeouts: Closeout[];
}

export interface ResolveResult {
  card: Card;
  carry: Card | null;
}

export interface DropResult {
  requested: boolean;
  card: Card;
}

export interface WordOfDay {
  id: number;
  word: string;
  part_of_speech: string;
  definition: string;
  example: string;
  used: boolean;
}

export type AlertType = 'unconfirmed' | 'tray' | 'due_soon' | 'drop_requests';
export interface Alert {
  type: AlertType;
  count: number;
  minutes?: number;
}

export interface Streak {
  current: number;
  best: number;
}

export interface Today {
  date: string;
  encouragement: string | null;
  parent_note: string | null;
  word: WordOfDay | null;
  streak: Streak;
  alerts: Alert[];
}

export interface StatsTotals {
  planned_min: number;
  spent_min: number;
  structured_planned_min: number;
  structured_spent_min: number;
  done: number;
  partial: number;
  missed: number;
  unconfirmed: number;
  open: number;
  must_planned: number;
  must_done: number;
}

export interface StatsDay {
  date: string;
  planned_min: number;
  spent_min: number;
  done: number;
  partial: number;
  missed: number;
  unconfirmed: number;
  open: number;
  closed: boolean;
  mark: 'away' | 'rest' | null;
}

export interface Stats {
  from: string;
  to: string;
  today: string;
  totals: StatsTotals;
  by_category: { category_id: string; planned_min: number; spent_min: number }[];
  by_day: StatsDay[];
  tray: { count: number; minutes: number };
  streak: Streak;
  structured_weekly_max_min: number;
}

export interface Review {
  child_id: string;
  week_start: string;
  keep: string | null;
  change: string | null;
  stop: string | null;
  start: string | null;
  notes: string | null;
  updated_at: string;
}

export type ReviewInput = Partial<Pick<Review, 'keep' | 'change' | 'stop' | 'start' | 'notes'>>;

/** Backup document. Also the format of seed data and test fixtures. */
export interface ExportDoc {
  version: 1;
  exported_at?: string;
  tables: {
    app_config?: Record<string, unknown>[];
    children?: ChildSummary[];
    categories?: Category[];
    library_items?: Partial<LibraryItem>[];
    goals?: Partial<Goal>[];
    cards?: Partial<Card>[];
    day_marks?: DayMark[];
    closeouts?: Partial<Closeout>[];
    words?: Omit<WordOfDay, 'used'>[];
    encouragements?: { id: number; text: string }[];
    word_uses?: { child_id: string; date: string; word_id: number }[];
    parent_notes?: { child_id: string; date: string; text: string }[];
    reviews?: Partial<Review>[];
  };
}

/** Error codes raised by the backend as 'QB:<code>'. */
export type ErrorCode =
  | 'not_signed_in'
  | 'not_parent'
  | 'not_allowed'
  | 'not_allowlisted'
  | 'not_found'
  | 'locked'
  | 'pin_not_set'
  | 'bad_input'
  | 'bad_code'
  | 'bad_token'
  | 'past_date'
  | 'future_card'
  | 'not_open'
  | 'not_resolved'
  | 'must_needs_parent'
  | 'carry_in_use'
  | 'open_cards'
  | 'network'
  | 'unknown';

export class ApiError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message?: string) {
    super(message ?? `QB:${code}`);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** Turns any thrown value into an ApiError. Backends raise 'QB:<code>'. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const msg =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  const m = /QB:([a-z_]+)/.exec(msg);
  if (m) return new ApiError(m[1] as ErrorCode, msg);
  return new ApiError('unknown', msg);
}
