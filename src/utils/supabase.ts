/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Student, DapodikSyncLog, UpdateNotification, SchoolSettings } from '../types';
import { secureStorage } from './security';

export const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
export const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are valid (i.e. not boilerplate/empty)
export const isConfigured = 
  !!supabaseUrl && 
  !!supabaseKey && 
  supabaseUrl !== 'https://your-project.supabase.co' && 
  supabaseKey !== 'your-anon-key';

export let supabase: any = null;

if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Supabase Client initialized successfully.");
  } catch (err) {
    console.warn("Could not construct Supabase Client:", err);
  }
} else {
  console.log("Supabase not fully configured. Running in high-performance local-first secure storage mode.");
}

// Emulate Auth state listeners
type AuthChangeListener = (user: any) => void;
const authListeners = new Set<AuthChangeListener>();

// Set a default mock/local session to start up seamlessly
let currentSessionUser: any = secureStorage.getItem('SPENDA_SUPABASE_MOCK_USER', {
  uid: 'local-operator-id',
  email: 'sendi263@guru.smp.belajar.id',
  displayName: 'Sendi Tio Alsi',
});

// Broadcast auth changes
function notifyAuthChange() {
  authListeners.forEach(listener => {
    listener(currentSessionUser);
  });
}

export const auth = {
  get currentUser() {
    return currentSessionUser;
  }
};

export const authService = {
  onAuthStateChange(callback: AuthChangeListener) {
    authListeners.add(callback);
    // Trigger instantly with current state
    callback(currentSessionUser);
    return () => {
      authListeners.delete(callback);
    };
  },

  async loginWithGoogle(): Promise<any> {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin
          }
        });
        if (error) throw error;
        return data;
      } catch (err) {
        console.error("Supabase Google Auth failed:", err);
        throw err;
      }
    } else {
      // Offline mock login
      const mockUser = {
        uid: 'google-mock-id',
        email: 'sendi263@guru.smp.belajar.id',
        displayName: 'Sendi Tio Alsi (Google Cloud Demo)'
      };
      currentSessionUser = mockUser;
      secureStorage.setItem('SPENDA_SUPABASE_MOCK_USER', mockUser);
      notifyAuthChange();
      return mockUser;
    }
  },

  async loginAnonymously(): Promise<any> {
    const mockUser = {
      uid: 'anon-mock-id',
      email: 'anonymous@smp.belajar.id',
      displayName: 'Operator Anonim'
    };
    currentSessionUser = mockUser;
    secureStorage.setItem('SPENDA_SUPABASE_MOCK_USER', mockUser);
    notifyAuthChange();
    return mockUser;
  },

  async logout(): Promise<void> {
    if (isConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Supabase signOut error:", err);
      }
    }
    currentSessionUser = null;
    secureStorage.removeItem('SPENDA_SUPABASE_MOCK_USER');
    notifyAuthChange();
  }
};

// Map Firebase structure listener directly
export function onAuthStateChanged(authInstance: any, callback: AuthChangeListener) {
  return authService.onAuthStateChange(callback);
}

// Database Interfaces
export const studentDb = {
  async getAll(): Promise<Student[]> {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        // If they use a generic single JSON record storage or flat columns
        return (data || []).map((row: any) => row.data ? { ...row.data, id: row.id } : row) as Student[];
      } catch (err) {
        console.warn("Supabase students load failed, loading from backup cache:", err);
      }
    }
    // Fallback load
    return secureStorage.getItem<Student[]>('SPENDA_STUDENTS', []);
  },

  async save(student: Student): Promise<void> {
    // Cache locally first for high availability
    const list = secureStorage.getItem<Student[]>('SPENDA_STUDENTS', []);
    const filtered = list.filter(s => s.id !== student.id);
    secureStorage.setItem('SPENDA_STUDENTS', [student, ...filtered]);

    if (isConfigured && supabase) {
      try {
        // Try flat column structure save, if failure, fallback to saving container data row
        const { error } = await supabase
          .from('students')
          .upsert({ ...student, data: student });
        if (error) {
          // Alternative fallback for JSON column representation
          await supabase.from('students').upsert({ id: student.id, data: student });
        }
      } catch (err) {
        console.warn("Could not save to remote Supabase server:", err);
      }
    }
  },

  async remove(studentId: string): Promise<void> {
    const list = secureStorage.getItem<Student[]>('SPENDA_STUDENTS', []);
    secureStorage.setItem('SPENDA_STUDENTS', list.filter(s => s.id !== studentId));

    if (isConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('students')
          .delete()
          .eq('id', studentId);
        if (error) throw error;
      } catch (err) {
        console.warn("Could not delete from remote Supabase server:", err);
      }
    }
  },

  async saveBatch(students: Student[]): Promise<void> {
    // Backup cache
    const list = secureStorage.getItem<Student[]>('SPENDA_STUDENTS', []);
    const map = new Map(list.map(s => [s.id, s]));
    students.forEach(s => map.set(s.id, s));
    secureStorage.setItem('SPENDA_STUDENTS', Array.from(map.values()));

    if (isConfigured && supabase) {
      try {
        const payloads = students.map(s => ({ ...s, data: s }));
        const { error } = await supabase
          .from('students')
          .upsert(payloads);
        if (error) {
          // JSON storage fallback
          const jsonPayloads = students.map(s => ({ id: s.id, data: s }));
          await supabase.from('students').upsert(jsonPayloads);
        }
      } catch (err) {
        console.warn("Could not batch save to remote Supabase server:", err);
      }
    }
  }
};

export const syncLogDb = {
  async getAll(): Promise<DapodikSyncLog[]> {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('sync_logs')
          .select('*')
          .order('timestamp', { ascending: false });
        if (error) {
          // Try alternative plural name
          const alt = await supabase.from('syncLogs').select('*').order('timestamp', { ascending: false });
          if (alt.error) throw error;
          return (alt.data || []).map((row: any) => row.data || row);
        }
        return (data || []).map((row: any) => row.data ? { ...row.data, id: row.id } : row) as DapodikSyncLog[];
      } catch (err) {
        console.warn("Supabase loading sync_logs failed, using cached:", err);
      }
    }
    return secureStorage.getItem<DapodikSyncLog[]>('SPENDA_SYNC_LOGS', []);
  },

  async save(log: DapodikSyncLog): Promise<void> {
    const list = secureStorage.getItem<DapodikSyncLog[]>('SPENDA_SYNC_LOGS', []);
    const filtered = list.filter(l => l.id !== log.id);
    secureStorage.setItem('SPENDA_SYNC_LOGS', [log, ...filtered]);

    if (isConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('sync_logs')
          .upsert({ ...log, data: log });
        if (error) {
          await supabase.from('sync_logs').upsert({ id: log.id, data: log });
        }
      } catch (err) {
        console.warn("Could not save sync_log to remote Supabase server:", err);
      }
    }
  }
};

export const notificationDb = {
  async getAll(): Promise<UpdateNotification[]> {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('date', { ascending: false });
        if (error) throw error;
        return (data || []).map((row: any) => row.data ? { ...row.data, id: row.id } : row) as UpdateNotification[];
      } catch (err) {
        console.warn("Supabase notifications fetch failed, return cached:", err);
      }
    }
    return secureStorage.getItem<UpdateNotification[]>('SPENDA_NOTIFICATIONS', []);
  },

  async save(notif: UpdateNotification): Promise<void> {
    const list = secureStorage.getItem<UpdateNotification[]>('SPENDA_NOTIFICATIONS', []);
    const filtered = list.filter(n => n.id !== notif.id);
    secureStorage.setItem('SPENDA_NOTIFICATIONS', [notif, ...filtered]);

    if (isConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('notifications')
          .upsert({ ...notif, data: notif });
        if (error) {
          await supabase.from('notifications').upsert({ id: notif.id, data: notif });
        }
      } catch (err) {
        console.warn("Could not save notification to remote Supabase server:", err);
      }
    }
  },

  async remove(notifId: string): Promise<void> {
    const list = secureStorage.getItem<UpdateNotification[]>('SPENDA_NOTIFICATIONS', []);
    secureStorage.setItem('SPENDA_NOTIFICATIONS', list.filter(n => n.id !== notifId));

    if (isConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notifId);
        if (error) throw error;
      } catch (err) {
        console.warn("Could not delete notification from remote Supabase server:", err);
      }
    }
  }
};

export const schoolSettingsDb = {
  async get(id = 'default_settings'): Promise<SchoolSettings | null> {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('school_settings')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) {
          const alt = await supabase.from('schoolSettings').select('*').eq('id', id).maybeSingle();
          if (alt.error) throw error;
          return alt.data ? (alt.data.data || alt.data) : null;
        }
        return data ? (data.data || data) : null;
      } catch (err) {
        console.warn("Supabase school_settings failed, returns cached version:", err);
      }
    }
    return secureStorage.getItem<SchoolSettings | null>('SPENDA_SCHOOL_SETTINGS', null);
  },

  async save(settings: SchoolSettings, id = 'default_settings'): Promise<void> {
    secureStorage.setItem('SPENDA_SCHOOL_SETTINGS', settings);

    if (isConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('school_settings')
          .upsert({ id, ...settings, data: settings });
        if (error) {
          await supabase.from('school_settings').upsert({ id, data: settings });
        }
      } catch (err) {
        console.warn("Could not save school_settings to remote Supabase server:", err);
      }
    }
  }
};

export const registeredUsersDb = {
  async getAll(): Promise<any[]> {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('registered_users')
          .select('*');
        
        let rawList = data || [];
        if (error) {
          const alt = await supabase.from('registeredUsers').select('*');
          if (alt.error) throw error;
          rawList = alt.data || [];
        }

        return rawList.map((row: any) => {
          let userObj = null;
          
          if (row.data) {
            if (typeof row.data === 'string') {
              try {
                userObj = JSON.parse(row.data);
              } catch (e) {
                userObj = null;
              }
            } else if (typeof row.data === 'object') {
              userObj = row.data;
            }
          }
          
          if (!userObj || typeof userObj !== 'object') {
            userObj = { ...row };
          } else {
            userObj = {
              ...userObj,
              email: row.email || userObj.email,
              activatePaid: row.activatePaid !== undefined ? row.activatePaid : userObj.activatePaid,
              password: row.password || userObj.password,
              role: row.role || userObj.role,
              name: row.name || userObj.name
            };
          }

          if (userObj && userObj.email) {
            userObj.email = userObj.email.toLowerCase();
          }
          return userObj;
        });
      } catch (err) {
        console.warn("Supabase registered_users load failed, using local backup fallback:", err);
      }
    }
    return secureStorage.getItem<any[]>('SPENDA_REGISTERED_USERS', []);
  },

  async save(user: any): Promise<void> {
    // If it is the demo account, NEVER save to Supabase to respect security & offline demo constraints
    if (user.email.toLowerCase() === 'demo@smp.belajar.id') {
      return;
    }

    if (isConfigured && supabase) {
      try {
        // Upsert standard structured wrapper
        const { error } = await supabase
          .from('registered_users')
          .upsert({ email: user.email.toLowerCase(), data: user });
        if (error) {
          // If the schema matches flat columns, fallback to that
          await supabase.from('registered_users').upsert({ ...user, data: user });
        }
      } catch (err) {
        console.warn("Could not save registered user to remote Supabase:", err);
      }
    }
  },

  async saveBatch(users: any[]): Promise<void> {
    if (isConfigured && supabase) {
      try {
        // Filter out demo user
        const toSave = users.filter((u: any) => u.email.toLowerCase() !== 'demo@smp.belajar.id');
        const payloads = toSave.map((u: any) => ({
          email: u.email.toLowerCase(),
          data: u
        }));
        if (payloads.length > 0) {
          const { error } = await supabase
            .from('registered_users')
            .upsert(payloads);
          if (error) {
            // Flat fallback
            const flatPayloads = toSave.map((u: any) => ({ ...u, data: u }));
            await supabase.from('registered_users').upsert(flatPayloads);
          }
        }
      } catch (err) {
        console.warn("Could not batch save registered users to remote Supabase:", err);
      }
    }
  }
};

