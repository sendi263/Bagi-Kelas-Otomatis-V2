# Security Specification & Invariants for EduData SPENDA

## 1. Data Invariants
- **Students**: Every student record must have a unique ID, valid `name` (string <= 200 chars), gender (`L` or `P`), NISN, NIK, class designation, and status (`Aktif`, `Lulus`, `Mutasi`, or `Non-Aktif`). The record's `lastUpdated` timestamp must be kept up-to-date.
- **Sync Logs**: Each sync log record represents an operator-triggered synchronization event. It is immutable after creation.
- **School Settings**: Only a authorized chief operator or administrator can update the official school metadata.
- **Notifications**: System notifications or operator chores. These must be structured with explicit type values (`info`, `warning`, `success`).

## 2. The "Dirty Dozen" Payloads (Denial Vectors)
1. **Malicious Student Creation No Gender**:
   - `id: "malicious-1", name: "Hacker", gender: "X", status: "Aktif"` (Fails gender enum check)
2. **Student Grade Spamming**:
   - `averageGrade: 999` (Fails boundary checks, average grade max 100)
3. **Ghost Collection Write**:
   - Creating documents in a non-existent `/admin_claims` path (Blocked by master deny rule)
4. **NISN Over-injection**:
   - Sending a 10MB string inside the NISN field (Blocked by size constraint)
5. **Dapodik Log State Shortcut**:
   - Attempting to update an existing sync log's operators or record count (Blocked by mutation restriction)
6. **Orphaned Student Writes**:
   - Student document ID containing dangerous control characters or symbols (Blocked by isValidId)
7. **Identity Theft Draft**:
   - Updating schoolSettings without being an authorized authenticated operator.
8. **Malicious Empty Name Notification**:
   - Creating a notification with empty title.
9. **Fake Email Verified claim**:
   - Requesting premium write permission without a valid active session.
10. **School Settings No NPSN**:
    - Purging NPSN code from the official school metadata.
11. **Student Deletion by Anonymous Caller**:
    - Dropping database contents as a guest session.
12. **Status Progression Jump**:
    - Overriding the status to a non-existent class or state code.

## 3. Test Cases (firestore.rules)
All cases below will be checked against the active ruleset.
