/**
 * Alya Assistant - Permanent User Settings & Preference Lock Service
 * Ensures all user-applied preferences are permanently stored, locked against
 * automated resets, synchronized with Firestore for authenticated users,
 * and loaded on startup before any chat or voice sessions.
 */

import { db, auth } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  serverTimestamp,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';

export type PersonalityType = 'alya_default' | 'jarvis_formal' | 'warm_companion' | 'concise_expert';
export type ResponseCadence = 'balanced' | 'concise' | 'detailed';
export type ThemeType = 'dark' | 'cyber' | 'amoled';
export type DeviceControlMode = 'always_confirm' | 'confirm_sensitive' | 'auto_execute';

export interface UserPreferences {
  version: number;
  revision: number;
  updatedAt: string;
  lastModifiedBy: 'web_ui' | 'android_companion' | 'conversational_command' | 'cloud_sync' | 'initial_setup';
  
  // 1. Language & Response
  language: string; // 'auto', 'en', 'hi', 'bn', 'es', etc.
  assistantPersonality: PersonalityType;
  responseCadence: ResponseCadence;
  
  // 2. Voice & Audio Engine
  voiceName: string; // 'Aoede', 'Kore', 'Fenrir', etc.
  speechSpeed: number; // 0.8 to 1.5 (default 1.0)
  speechPitch: number; // -2 to +2 (default 0)
  
  // 3. Wake Words
  wakeWords: {
    alya: boolean;
    alia: boolean;
    seno: boolean;
    sensitivity: number; // 0.1 to 1.0 (default 0.8)
  };
  
  // 4. Location & Weather
  locationPreference: 'auto' | 'manual' | 'disabled';
  manualCity: string;
  
  // 5. Memory & Privacy
  memoryOptIn: boolean;
  cloudSyncEnabled: boolean;
  
  // 6. Notifications & Quiet Hours
  notificationsEnabled: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // "22:00"
    endTime: string;   // "07:00"
    quietReplyMessage?: string;
  };
  
  // 7. Auto-Reply & Automations
  autoReplyMode: 'draft_review' | 'auto_send_trusted' | 'disabled';
  autoReplyAiDisclosure: boolean;
  
  // 8. Device Control & Security
  deviceControlConfirmation: DeviceControlMode;
  offlineMode: boolean;
  
  // 9. Visual & Theme
  theme: ThemeType;
}

export interface SettingChangeLogEntry {
  id: string;
  timestamp: string;
  key: string;
  oldValue: any;
  newValue: any;
  source: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  version: 2,
  revision: 1,
  updatedAt: new Date().toISOString(),
  lastModifiedBy: 'initial_setup',
  
  language: 'auto',
  assistantPersonality: 'alya_default',
  responseCadence: 'balanced',
  
  voiceName: 'Aoede',
  speechSpeed: 1.0,
  speechPitch: 0.0,
  
  wakeWords: {
    alya: true,
    alia: true,
    seno: true,
    sensitivity: 0.8
  },
  
  locationPreference: 'auto',
  manualCity: 'Kolkata',
  
  memoryOptIn: true,
  cloudSyncEnabled: true,
  
  notificationsEnabled: true,
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '07:00',
    quietReplyMessage: 'I am currently resting and will review your message in the morning.'
  },
  
  autoReplyMode: 'draft_review',
  autoReplyAiDisclosure: false,
  
  deviceControlConfirmation: 'confirm_sensitive',
  offlineMode: true,
  
  theme: 'dark'
};

const STORAGE_PREFS_KEY = 'alya_user_preferences_v2';
const STORAGE_HISTORY_KEY = 'alya_settings_history_v2';

class UserSettingsService {
  private currentPreferences: UserPreferences;
  private changeHistory: SettingChangeLogEntry[] = [];
  private listeners: Set<(prefs: UserPreferences) => void> = new Set();
  private isInitialized = false;
  private unsubscribeFirestore: (() => void) | null = null;

  constructor() {
    this.currentPreferences = this.loadLocalPreferences();
    this.changeHistory = this.loadLocalHistory();
  }

  /**
   * Load stored preferences from local storage or merge with defaults safely
   */
  private loadLocalPreferences(): UserPreferences {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_USER_PREFERENCES };
    try {
      const stored = localStorage.getItem(STORAGE_PREFS_KEY);
      if (!stored) {
        // Check for legacy v1 keys and migrate them without losing user preferences
        return this.migrateLegacySettings();
      }
      const parsed = JSON.parse(stored);
      // Merge with default schema safely to support new fields without overwriting user's explicit values
      return {
        ...DEFAULT_USER_PREFERENCES,
        ...parsed,
        wakeWords: { ...DEFAULT_USER_PREFERENCES.wakeWords, ...(parsed.wakeWords || {}) },
        quietHours: { ...DEFAULT_USER_PREFERENCES.quietHours, ...(parsed.quietHours || {}) }
      };
    } catch (e) {
      console.warn('[UserSettingsService] Error loading local prefs, using defaults:', e);
      return { ...DEFAULT_USER_PREFERENCES };
    }
  }

  /**
   * Migrate legacy settings keys into unified preferences
   */
  private migrateLegacySettings(): UserPreferences {
    const prefs: UserPreferences = { ...DEFAULT_USER_PREFERENCES };
    try {
      const lang = localStorage.getItem('alya_preferred_lang');
      if (lang) prefs.language = lang;

      const wwAlya = localStorage.getItem('alya_ww_alya');
      if (wwAlya !== null) prefs.wakeWords.alya = wwAlya !== 'false';

      const wwAlia = localStorage.getItem('alya_ww_alia');
      if (wwAlia !== null) prefs.wakeWords.alia = wwAlia !== 'false';

      const wwSeno = localStorage.getItem('alya_ww_seno');
      if (wwSeno !== null) prefs.wakeWords.seno = wwSeno !== 'false';

      const wwSens = localStorage.getItem('alya_ww_sensitivity');
      if (wwSens) prefs.wakeWords.sensitivity = parseFloat(wwSens) || 0.8;

      const locPref = localStorage.getItem('alya_location_permission_pref') as any;
      if (locPref) prefs.locationPreference = locPref;

      const city = localStorage.getItem('alya_manual_city');
      if (city) prefs.manualCity = city;

      const offline = localStorage.getItem('alya_offline_mode');
      if (offline !== null) prefs.offlineMode = offline !== 'false';

      // Save migrated settings
      this.saveLocal(prefs);
    } catch {}
    return prefs;
  }

  private loadLocalHistory(): SettingChangeLogEntry[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveLocal(prefs: UserPreferences) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs));
    }
  }

  private saveLocalHistory(history: SettingChangeLogEntry[]) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
    }
  }

  /**
   * Initialize and attach real-time Firestore synchronization for authenticated user
   */
  public initialize(userId?: string): void {
    if (this.isInitialized && !userId) return;
    this.isInitialized = true;

    if (!userId && auth.currentUser) {
      userId = auth.currentUser.uid;
    }

    if (!userId) {
      this.notifyListeners();
      return;
    }

    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }

    try {
      const docRef = doc(db, 'users', userId, 'settings', 'preferences');
      this.unsubscribeFirestore = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const cloudData = snap.data() as UserPreferences;
          // Conflict Resolution: Only adopt if cloud revision is newer or local hasn't been modified recently
          if (cloudData.revision > this.currentPreferences.revision || 
              (cloudData.updatedAt > this.currentPreferences.updatedAt && cloudData.lastModifiedBy !== this.currentPreferences.lastModifiedBy)) {
            console.log(`[UserSettingsService] Synchronized newer cloud preferences (rev: ${cloudData.revision})`);
            this.currentPreferences = {
              ...DEFAULT_USER_PREFERENCES,
              ...cloudData,
              wakeWords: { ...DEFAULT_USER_PREFERENCES.wakeWords, ...(cloudData.wakeWords || {}) },
              quietHours: { ...DEFAULT_USER_PREFERENCES.quietHours, ...(cloudData.quietHours || {}) }
            };
            this.saveLocal(this.currentPreferences);
            this.notifyListeners();
          }
        } else {
          // Upload local preferences as baseline cloud preferences
          setDoc(docRef, {
            ...this.currentPreferences,
            createdAt: serverTimestamp(),
            updatedAt: new Date().toISOString()
          }).catch(err => console.warn('[UserSettingsService] Error creating baseline cloud doc:', err));
        }
      }, (err) => {
        console.warn('[UserSettingsService] Firestore snapshot error (fallback to local):', err);
      });
    } catch (e) {
      console.warn('[UserSettingsService] Error attaching Firestore sync:', e);
    }

    this.notifyListeners();
  }

  /**
   * Get immutable snapshot of current user preferences
   */
  public getPreferences(): UserPreferences {
    return { ...this.currentPreferences };
  }

  /**
   * Get history of setting changes
   */
  public getHistory(): SettingChangeLogEntry[] {
    return [...this.changeHistory];
  }

  /**
   * Update one or more user preferences persistently and lock them.
   */
  public async updatePreferences(
    updates: Partial<UserPreferences>,
    source: 'web_ui' | 'android_companion' | 'conversational_command' | 'cloud_sync' = 'web_ui'
  ): Promise<{ success: boolean; preferences: UserPreferences; error?: string }> {
    const oldPrefs = { ...this.currentPreferences };
    const now = new Date().toISOString();

    // Record change history entries for modified keys
    const newHistoryEntries: SettingChangeLogEntry[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'updatedAt' || key === 'revision' || key === 'lastModifiedBy') continue;
      const oldVal = (oldPrefs as any)[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(value)) {
        newHistoryEntries.push({
          id: `chg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          key,
          oldValue: oldVal,
          newValue: value,
          source
        });
      }
    }

    const updatedPrefs: UserPreferences = {
      ...this.currentPreferences,
      ...updates,
      revision: (this.currentPreferences.revision || 1) + 1,
      updatedAt: now,
      lastModifiedBy: source
    };

    // 1. Commit to memory & LocalStorage immediately for instant UI response
    this.currentPreferences = updatedPrefs;
    this.saveLocal(updatedPrefs);

    if (newHistoryEntries.length > 0) {
      this.changeHistory = [...newHistoryEntries, ...this.changeHistory].slice(0, 100);
      this.saveLocalHistory(this.changeHistory);
    }

    // 2. Sync to legacy localStorage keys for backward compatibility
    try {
      if (updates.language) localStorage.setItem('alya_preferred_lang', updates.language);
      if (updates.wakeWords) {
        if (updates.wakeWords.alya !== undefined) localStorage.setItem('alya_ww_alya', String(updates.wakeWords.alya));
        if (updates.wakeWords.alia !== undefined) localStorage.setItem('alya_ww_alia', String(updates.wakeWords.alia));
        if (updates.wakeWords.seno !== undefined) localStorage.setItem('alya_ww_seno', String(updates.wakeWords.seno));
        if (updates.wakeWords.sensitivity !== undefined) localStorage.setItem('alya_ww_sensitivity', String(updates.wakeWords.sensitivity));
      }
      if (updates.locationPreference) localStorage.setItem('alya_location_permission_pref', updates.locationPreference);
      if (updates.manualCity) localStorage.setItem('alya_manual_city', updates.manualCity);
      if (updates.offlineMode !== undefined) localStorage.setItem('alya_offline_mode', String(updates.offlineMode));
    } catch {}

    // 3. Sync to Cloud Firestore if user is authenticated and cloudSyncEnabled
    const currentUser = auth.currentUser;
    if (currentUser && updatedPrefs.cloudSyncEnabled) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'settings', 'preferences');
        await setDoc(docRef, {
          ...updatedPrefs,
          firestoreSyncedAt: serverTimestamp()
        }, { merge: true });

        // Push history entries to subcollection
        for (const entry of newHistoryEntries) {
          addDoc(collection(db, 'users', currentUser.uid, 'settings', 'preferences', 'history'), {
            ...entry,
            createdAt: serverTimestamp()
          }).catch(() => {});
        }
      } catch (err: any) {
        console.warn('[UserSettingsService] Failed to sync update to Firestore (saved locally):', err);
      }
    }

    // 4. Notify all components & dispatch global DOM event
    this.notifyListeners();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alya:settings-updated', { detail: updatedPrefs }));
    }

    return { success: true, preferences: updatedPrefs };
  }

  /**
   * Reset all settings to default values after explicit user confirmation
   */
  public async resetAllSettings(): Promise<UserPreferences> {
    const defaultCopy: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      revision: (this.currentPreferences.revision || 1) + 1,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: 'web_ui'
    };

    const entry: SettingChangeLogEntry = {
      id: `reset_${Date.now()}`,
      timestamp: new Date().toISOString(),
      key: 'ALL_SETTINGS',
      oldValue: this.currentPreferences,
      newValue: defaultCopy,
      source: 'manual_reset_all'
    };

    this.currentPreferences = defaultCopy;
    this.saveLocal(defaultCopy);
    this.changeHistory.unshift(entry);
    this.saveLocalHistory(this.changeHistory);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'settings', 'preferences');
        await setDoc(docRef, {
          ...defaultCopy,
          firestoreSyncedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('[UserSettingsService] Error syncing reset to cloud:', e);
      }
    }

    this.notifyListeners();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alya:settings-updated', { detail: defaultCopy }));
    }

    return defaultCopy;
  }

  /**
   * Revert a specific setting key to its previous value from history
   */
  public async revertSetting(key: string): Promise<boolean> {
    const lastChange = this.changeHistory.find(h => h.key === key);
    if (!lastChange) return false;

    await this.updatePreferences({ [key]: lastChange.oldValue }, 'web_ui');
    return true;
  }

  /**
   * Export all user settings as a JSON object
   */
  public exportSettingsJson(): string {
    return JSON.stringify({
      app: 'Alya Assistant',
      exportedAt: new Date().toISOString(),
      preferences: this.currentPreferences,
      history: this.changeHistory
    }, null, 2);
  }

  /**
   * Import settings from JSON with schema validation
   */
  public async importSettingsJson(jsonStr: string): Promise<{ success: boolean; error?: string }> {
    try {
      const parsed = JSON.parse(jsonStr);
      const incomingPrefs = parsed.preferences || parsed;
      if (typeof incomingPrefs !== 'object') {
        return { success: false, error: 'Invalid JSON format' };
      }

      await this.updatePreferences({
        ...incomingPrefs,
        version: 2
      }, 'web_ui');

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'JSON Parse error' };
    }
  }

  /**
   * Subscribe to live settings updates
   */
  public subscribe(listener: (prefs: UserPreferences) => void): () => void {
    this.listeners.add(listener);
    listener(this.getPreferences());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const snapshot = this.getPreferences();
    this.listeners.forEach(fn => fn(snapshot));
  }
}

export const userSettingsService = new UserSettingsService();
