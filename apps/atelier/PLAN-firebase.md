---
name: Firebase Integration Plan
description: Storage, auth, sharing, and real-time collaboration for Atelier
---

# Atelier Firebase Integration Plan

## Current State
- Elements are in-memory only (lost on page close)
- Projects stored in localStorage (metadata only, no elements)
- No auth, no sharing, no cloud storage
- AI generation is mocked (template-based)

## Phase 1: Storage Adapter + Persistence (Pre-Firebase)

### 1. StorageAdapter Interface (`app/utils/storage-types.ts`)
```typescript
interface StorageAdapter {
  listProjects(userId: string): Promise<ProjectRecord[]>;
  getProject(projectId: string): Promise<ProjectRecord | undefined>;
  createProject(project: ProjectRecord): Promise<void>;
  updateProject(projectId: string, updates: Partial<ProjectRecord>): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  loadElements(projectId: string): Promise<DesignElement[]>;
  saveElements(projectId: string, elements: DesignElement[]): Promise<void>;
}
```

### 2. LocalStorageAdapter (`app/utils/local-storage-adapter.ts`)
- Projects: `atelier-projects` key (existing)
- Elements: `atelier-elements-{projectId}` key (new)
- Seed example projects with actual elements on first load

### 3. design-store.ts Changes
- Add `currentProjectId` tracked property
- Add `loadProject(id)` - loads elements from adapter
- Add `scheduleSave()` - debounced (500ms) auto-save after mutations
- Wire all mutators to call scheduleSave: createElement, updateElement, deleteSelected, paste, bringToFront, sendToBack, clearCanvas, groupSelected, alignSelected

### 4. project-store.ts Changes
- Refactor to use StorageAdapter
- Add `ownerId` field to ProjectRecord (default: "local")
- Add `collaboratorIds` field (empty array for now)
- Make all methods async

### 5. Editor Route Changes
- `model()` hook calls `designStore.loadProject(params.project_id)`
- Async model loading

## Phase 2: Firebase Setup

### Firebase Services Needed
- **Authentication** - Google sign-in, anonymous auth
- **Firestore** - Project and element storage
- **Hosting** - Optional (currently on GitHub Pages)
- **Storage** - Image uploads (future)

### Firestore Data Model
```
users/{uid}
  displayName, email, photoURL, createdAt

projects/{projectId}
  name, ownerId, collaboratorIds[], createdAt, updatedAt, elementCount

projects/{projectId}/elements/{elementId}
  type, x, y, width, height, fill, stroke, opacity, ...

  OR (simpler, recommended for MVP):

projects/{projectId}
  name, ownerId, elements: DesignElement[] (embedded array)
  // Firestore doc limit is 1MB, ~1000 elements fits easily
```

**Recommendation:** Start with embedded elements array. It's simpler, faster to load (one read), and cheaper (one document read per project open). Move to subcollection only if projects exceed ~500 elements regularly.

### FirebaseAdapter (`app/utils/firebase-adapter.ts`)
- Implements same StorageAdapter interface
- Uses Firestore SDK
- Swap in via service initializer or environment config

### Auth Service (`app/services/auth-service.ts`)
```typescript
interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}
```
- Google sign-in button on projects home
- Anonymous auth as fallback (auto-create on first visit)
- User avatar in top-right of projects home and editor topbar
- Auth state persisted by Firebase SDK

## Phase 3: Sharing & Collaboration

### Sharing
- "Share" button in editor topbar
- Share modal: enter email, set permission (view/edit)
- Adds uid to project's `collaboratorIds`
- "Shared with me" tab on projects home (already in UI from Stitch inspiration)
- Firestore security rules enforce access

### Real-time Collaboration (Future)
- Firestore `onSnapshot` for live element updates
- Cursor presence via Firestore or Realtime Database
- Element locking (optimistic, show who's editing what)
- Conflict resolution: last-write-wins for simple properties

## Phase 4: AI Backend

### Replace Mocked AI with Real Generation
- Cloud Function that calls Claude/GPT API
- Prompt -> structured JSON -> elements array
- Store API key in Firebase Functions config
- Rate limiting per user
- Generation history stored in Firestore

### Voice-to-Design Pipeline
- Web Speech API (current) -> transcript -> Cloud Function -> AI -> elements
- OR: Cloud Speech-to-Text for cross-browser support

## Implementation Order
1. StorageAdapter + LocalStorageAdapter + auto-save (pre-Firebase, do now)
2. Firebase project setup + FirebaseAdapter (when Firebase project exists)
3. Auth (Google sign-in)
4. Cloud persistence (swap adapter)
5. Sharing UI + Firestore rules
6. Real-time sync
7. AI Cloud Functions
