/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged, User as FirebaseUser, signInAnonymously } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  onSnapshot, 
  query, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Student, DapodikSyncLog, UpdateNotification, SchoolSettings } from '../types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();

// Test Connection on Initial Startup as per skill manual
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: client is offline.");
    } else {
      console.log("Firebase initialized (offline cache enabled or standard ready).");
    }
  }
}
testConnection();

// OPERATION ENUM FOR ERROR HANDLING
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// CRITICAL HANDLER: conformance to firebase-integration skill manual
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// SECURE DATA HELPERS CONTROLLING DATA ACCORDING TO SKILL SPECIFICATION

export const studentDb = {
  async getAll(): Promise<Student[]> {
    const colName = 'students';
    try {
      const q = query(collection(db, colName));
      const querySnapshot = await getDocs(q);
      const list: Student[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Student);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, colName);
    }
  },

  async save(student: Student): Promise<void> {
    const pathName = `students/${student.id}`;
    try {
      await setDoc(doc(db, 'students', student.id), student);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathName);
    }
  },

  async remove(studentId: string): Promise<void> {
    const pathName = `students/${studentId}`;
    try {
      await deleteDoc(doc(db, 'students', studentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, pathName);
    }
  },

  async saveBatch(students: Student[]): Promise<void> {
    const colName = 'students';
    try {
      for (const student of students) {
        await setDoc(doc(db, colName, student.id), student);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, colName);
    }
  }
};

export const syncLogDb = {
  async getAll(): Promise<DapodikSyncLog[]> {
    const colName = 'syncLogs';
    try {
      const querySnapshot = await getDocs(collection(db, colName));
      const list: DapodikSyncLog[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push(docSnap.data() as DapodikSyncLog);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, colName);
    }
  },

  async save(log: DapodikSyncLog): Promise<void> {
    const pathName = `syncLogs/${log.id}`;
    try {
      await setDoc(doc(db, 'syncLogs', log.id), log);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathName);
    }
  }
};

export const notificationDb = {
  async getAll(): Promise<UpdateNotification[]> {
    const colName = 'notifications';
    try {
      const querySnapshot = await getDocs(collection(db, colName));
      const list: UpdateNotification[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push(docSnap.data() as UpdateNotification);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, colName);
    }
  },

  async save(notif: UpdateNotification): Promise<void> {
    const pathName = `notifications/${notif.id}`;
    try {
      await setDoc(doc(db, 'notifications', notif.id), notif);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathName);
    }
  },

  async remove(notifId: string): Promise<void> {
    const pathName = `notifications/${notifId}`;
    try {
      await deleteDoc(doc(db, 'notifications', notifId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, pathName);
    }
  }
};

export const schoolSettingsDb = {
  async get(id = 'default_settings'): Promise<SchoolSettings | null> {
    const pathName = `schoolSettings/${id}`;
    try {
      const docSnap = await getDoc(doc(db, 'schoolSettings', id));
      if (docSnap.exists()) {
        return docSnap.data() as SchoolSettings;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, pathName);
    }
  },

  async save(settings: SchoolSettings, id = 'default_settings'): Promise<void> {
    const pathName = `schoolSettings/${id}`;
    try {
      await setDoc(doc(db, 'schoolSettings', id), settings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathName);
    }
  }
};

// GOOGLE AUTHENTICATION INTEGRATION
export const authService = {
  async loginWithGoogle(): Promise<FirebaseUser | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      console.error("Popup signIn failed, or blocked.", error);
      return null;
    }
  },

  async loginAnonymously(): Promise<FirebaseUser | null> {
    try {
      const result = await signInAnonymously(auth);
      return result.user;
    } catch (error) {
      console.error("signInAnonymously failed", error);
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("signOut failed", error);
    }
  }
};
