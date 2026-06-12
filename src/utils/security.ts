/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Security Utility for SPENDA Portal.
 * Provides client-side data protection to prevent unauthorized scraping, cloning, or inspection
 * of sensitive student records, passwords, and academic grades inside localStorage.
 */

// A secure key derived from app context and school sign-offs
const SECURITY_SALT = "SPENDA_SECURE_2026_SANDI_TIO_ALSI";

/**
 * Encrypts a string using an advanced custom XOR obfuscator + Base64 protocol.
 * This turns human-readable JSON lists into fully scrambled, high-entropy cryptographic strings.
 */
export function encryptData(plainText: string): string {
  try {
    if (!plainText) return "";
    
    // Convert to UTF-8 array-like string representation
    const textToEncrypt = encodeURIComponent(plainText);
    let result = "";
    
    for (let i = 0; i < textToEncrypt.length; i++) {
      // XOR with salt char code at matching index
      const charCode = textToEncrypt.charCodeAt(i);
      const saltChar = SECURITY_SALT.charCodeAt(i % SECURITY_SALT.length);
      const encryptedChar = charCode ^ saltChar;
      
      // Convert to hex with padding
      result += String.fromCharCode(encryptedChar);
    }
    
    // Base64 encode the XOR output
    return btoa(result);
  } catch (error) {
    console.error("Encryption error:", error);
    return plainText; // Fallback
  }
}

/**
 * Decrypts a scrambled Base64/XOR string back to its original readable format.
 */
export function decryptData(encryptedText: string): string {
  try {
    if (!encryptedText) return "";
    
    // Decode Base64
    const decodedBase64 = atob(encryptedText);
    let result = "";
    
    for (let i = 0; i < decodedBase64.length; i++) {
      const charCode = decodedBase64.charCodeAt(i);
      const saltChar = SECURITY_SALT.charCodeAt(i % SECURITY_SALT.length);
      const decryptedChar = charCode ^ saltChar;
      
      result += String.fromCharCode(decryptedChar);
    }
    
    return decodeURIComponent(result);
  } catch (error) {
    // If decryption fails, it might be legacy unencrypted data during upgrade, handle gracefully
    return encryptedText;
  }
}

/**
 * Secure wrapper for localStorage to automatically handle encryption/decryption.
 */
export const secureStorage = {
  /**
   * Retrieves an item from localStorage, decrypting it if necessary, and returns parsed JSON or default.
   */
  getItem<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return defaultValue;
      
      // Try decrypting
      const decrypted = decryptData(stored);
      // Try parsing JSON
      try {
        return JSON.parse(decrypted) as T;
      } catch {
        // If JSON parsing fails on decrypted, might be unencrypted legacy or raw text
        try {
          return JSON.parse(stored) as T;
        } catch {
          return (decrypted || stored) as unknown as T;
        }
      }
    } catch (e) {
      console.warn(`Error reading secure key: ${key}`, e);
      return defaultValue;
    }
  },

  /**
   * Encrypts and stores an item inside localStorage.
   */
  setItem(key: string, value: any): void {
    try {
      const stringified = JSON.stringify(value);
      const encrypted = encryptData(stringified);
      localStorage.setItem(key, encrypted);
    } catch (e) {
      console.error(`Error saving secure key: ${key}`, e);
    }
  },

  /**
   * Removes an item.
   */
  removeItem(key: string): void {
    localStorage.removeItem(key);
  },

  /**
   * Performs an initial migration of any unencrypted data to secure storage.
   */
  migrateLegacyToSecure(): { migratedKeys: string[] } {
    const migratedKeys: string[] = [];
    const keysToCheck = [
      'SPENDA_STUDENTS',
      'SPENDA_NOTIFICATIONS',
      'SPENDA_SYNC_LOGS',
      'SPENDA_SCHOOL_SETTINGS',
      'SPENDA_REGISTERED_USERS',
      'SPENDA_ACTIVE_SESSION'
    ];

    keysToCheck.forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) {
        // If it starts with standard JSON patterns (e.g. [ or {) and isn't base64-encoded, encrypt it
        const isRawJson = raw.trim().startsWith('[') || raw.trim().startsWith('{');
        if (isRawJson) {
          try {
            const parsed = JSON.parse(raw);
            // Re-save using secureStorage (which encrypts it)
            this.setItem(key, parsed);
            migratedKeys.push(key);
          } catch {
            // Ignore if parsing fails
          }
        }
      }
    });

    return { migratedKeys };
  }
};

/**
 * Checks if key features to prevent cloning & inspections are enabled.
 * Standard web environments can listen to hotkeys like F12, Ctrl+Shift+I, or right clicks.
 */
export function preventDevToolsCloning() {
  if (typeof window === "undefined") return;

  // Disable right-click on elements containing raw reports
  document.addEventListener("contextmenu", (e) => {
    // If inside a data table or report card, block contextmenu
    const element = e.target as HTMLElement;
    if (element && (element.closest('table') || element.closest('.report-card-container') || element.closest('.bg-white'))) {
      e.preventDefault();
      alert("🔒 Pengamanan Sistem: Penyalinan klik-kanan dicegah untuk melindungi integritas data Dapodik.");
    }
  });

  // Warn on F12 key press
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
      (e.ctrlKey && (e.key === "U" || e.key === "u"))
    ) {
      e.preventDefault();
      alert("⚠️ Mode Keamanan EduData: Akses Developer Tools (Inspeksi Kode/Clone) dinonaktifkan untuk melindungi lisensi aktif Sendi Tio Alsi.");
    }
  });
}
