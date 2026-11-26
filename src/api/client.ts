// The typed Questboard API. Every screen talks to the backend through this
// object and nothing else. There is one method per SQL function in
// db/migrations (see docs/04-data-and-api.md).
//
// Two backends implement `Backend`:
//   - MemoryBackend   (src/api/memoryBackend.ts): in-memory, for demo mode and tests
//   - SupabaseBackend (src/api/supabaseBackend.ts): the real thing
import type {
  Board, Card, CardPatch, Category, ChildSummary, Closeout, DayMark, DeviceRow, DropResult, ExportDoc,
  Goal, GoalInput, Library, LibraryItem, NewCard, PairingInfo, Remainder, ResolveResult, Review,
  ReviewInput, Settings, SettingsPatch, Stats, Today, UnlockResult, WhoAmI,
} from './types.ts';

export interface Backend {
  /** Calls one API function by name. Rejects with an error whose message contains 'QB:<code>'. */
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>;
}

export type Api = ReturnType<typeof createApi>;

export function createApi(b: Backend) {
  return {
    // --- Session ---------------------------------------------------------
    whoami: () => b.rpc<WhoAmI>('whoami'),
    claimParent: () => b.rpc<WhoAmI>('claim_parent'),
    deviceStartPairing: (label?: string) =>
      b.rpc<PairingInfo>('device_start_pairing', label === undefined ? {} : { p_label: label }),
    deviceApprove: (code: string, childId: string, kind: 'kid' | 'display' = 'kid', label?: string) =>
      b.rpc<DeviceRow>('device_approve', {
        p_code: code, p_child_id: childId, p_kind: kind, ...(label === undefined ? {} : { p_label: label }),
      }),
    deviceRevoke: (deviceId: string) => b.rpc<DeviceRow>('device_revoke', { p_device_id: deviceId }),
    deviceList: () => b.rpc<DeviceRow[]>('device_list'),
    setChildPin: (childId: string, pin: string) =>
      b.rpc<{ ok: true }>('set_child_pin', { p_child_id: childId, p_pin: pin }),
    kidUnlock: (pin: string) => b.rpc<UnlockResult>('kid_unlock', { p_pin: pin }),
    kidLock: () => b.rpc<{ ok: true }>('kid_lock'),

    // --- Settings --------------------------------------------------------
    getSettings: () => b.rpc<Settings>('get_settings'),
    updateSettings: (patch: SettingsPatch) => b.rpc<Settings>('update_settings', { p_patch: patch }),
    updateChild: (childId: string, patch: Partial<Pick<ChildSummary, 'name' | 'avatar' | 'theme'>>) =>
      b.rpc<ChildSummary>('update_child', { p_child_id: childId, p_patch: patch }),
    rotateAutomationToken: () => b.rpc<{ token: string }>('rotate_automation_token'),

    // --- Board -----------------------------------------------------------
    getBoard: (childId: string, from: string, to: string) =>
      b.rpc<Board>('get_board', { p_child_id: childId, p_from: from, p_to: to }),
    addCards: (childId: string, cards: NewCard[]) =>
      b.rpc<Card[]>('add_cards', { p_child_id: childId, p_cards: cards }),
    updateCard: (cardId: string, patch: CardPatch) =>
      b.rpc<Card>('update_card', { p_card_id: cardId, p_patch: patch }),
    /** Put a card on a day (optionally at a clock time), or back into a week's pool. */
    placeCard: (
      cardId: string,
      to: { place: 'day'; date: string; start_min?: number | null; sort?: number }
        | { place: 'week'; week_start?: string; sort?: number },
    ) =>
      b.rpc<Card>('place_card', {
        p_card_id: cardId,
        p_place: to.place,
        ...(to.place === 'day'
          ? { p_date: to.date, p_start_min: to.start_min ?? null }
          : to.week_start === undefined ? {} : { p_week_start: to.week_start }),
        ...(to.sort === undefined ? {} : { p_sort: to.sort }),
      }),
    startCard: (cardId: string) => b.rpc<Card>('start_card', { p_card_id: cardId }),
    stopCard: (cardId: string) => b.rpc<Card>('stop_card', { p_card_id: cardId }),
    /**
     * Say how much of a card got done (0-100). If less than 100, the remainder goes to the
     * Catch-up tray ('tray', default), onto a chosen day ('day'), or is let go ('let_go').
     */
    resolveCard: (
      cardId: string, pct: number,
      opts: { note?: string; remainder?: Remainder; new_date?: string; new_start_min?: number | null } = {},
    ) =>
      b.rpc<ResolveResult>('resolve_card', {
        p_card_id: cardId, p_pct: pct,
        ...(opts.note === undefined ? {} : { p_note: opts.note }),
        ...(opts.remainder === undefined ? {} : { p_remainder: opts.remainder }),
        ...(opts.new_date === undefined ? {} : { p_new_date: opts.new_date }),
        ...(opts.new_start_min === undefined ? {} : { p_new_start_min: opts.new_start_min }),
      }),
    reopenCard: (cardId: string) => b.rpc<Card>('reopen_card', { p_card_id: cardId }),
    dropCard: (cardId: string, reason?: string) =>
      b.rpc<DropResult>('drop_card', { p_card_id: cardId, ...(reason === undefined ? {} : { p_reason: reason }) }),
    decideDrop: (cardId: string, approve: boolean) =>
      b.rpc<Card>('decide_drop', { p_card_id: cardId, p_approve: approve }),
    deleteCard: (cardId: string) => b.rpc<{ ok: true }>('delete_card', { p_card_id: cardId }),
    closeDay: (childId: string, opts: { date?: string; mood?: number; note?: string } = {}) =>
      b.rpc<Closeout>('close_day', {
        p_child_id: childId,
        ...(opts.date === undefined ? {} : { p_date: opts.date }),
        ...(opts.mood === undefined ? {} : { p_mood: opts.mood }),
        ...(opts.note === undefined ? {} : { p_note: opts.note }),
      }),
    setDayMark: (childId: string, date: string, kind: 'away' | 'rest' | null, note?: string) =>
      b.rpc<DayMark | null>('set_day_mark', {
        p_child_id: childId, p_date: date, p_kind: kind, ...(note === undefined ? {} : { p_note: note }),
      }),

    // --- Goals, library, categories ---------------------------------------
    saveGoal: (childId: string, goal: GoalInput) => b.rpc<Goal>('save_goal', { p_child_id: childId, p_goal: goal }),
    getLibrary: () => b.rpc<Library>('get_library'),
    saveLibraryItem: (
      item: Partial<Pick<LibraryItem, 'id' | 'title' | 'category_id' | 'minutes' | 'description' | 'tags'>>,
    ) => b.rpc<LibraryItem>('save_library_item', { p_item: item }),
    archiveLibraryItem: (id: string) => b.rpc<{ ok: true }>('archive_library_item', { p_id: id }),
    saveCategory: (cat: Partial<Category> & { id: string }) => b.rpc<Category>('save_category', { p_cat: cat }),

    // --- Daily content, stats, reviews ------------------------------------
    getToday: (childId: string) => b.rpc<Today>('get_today', { p_child_id: childId }),
    markWordUsed: (childId: string, used: boolean) =>
      b.rpc<{ used: boolean }>('mark_word_used', { p_child_id: childId, p_used: used }),
    setParentNote: (childId: string, date: string, text: string | null) =>
      b.rpc<{ date: string; text: string | null }>('set_parent_note', { p_child_id: childId, p_date: date, p_text: text }),
    getStats: (childId: string, from: string, to: string) =>
      b.rpc<Stats>('get_stats', { p_child_id: childId, p_from: from, p_to: to }),
    getReview: (childId: string, weekStart: string) =>
      b.rpc<Review | null>('get_review', { p_child_id: childId, p_week_start: weekStart }),
    saveReview: (childId: string, weekStart: string, review: ReviewInput) =>
      b.rpc<Review>('save_review', { p_child_id: childId, p_week_start: weekStart, p_review: review }),

    // --- Backup -----------------------------------------------------------
    exportData: () => b.rpc<ExportDoc>('export_data'),
    importData: (data: ExportDoc) => b.rpc<Record<string, number>>('import_data', { p_data: data }),
  };
}
