---
name: Teams & Shared Editing Plan
description: Organizations, team workspaces, project sharing, and collaboration
---

# Atelier Teams & Shared Editing

## UX Concept

### Organization Model
An **Organization** (or "Team") is a shared workspace. Users can belong to multiple orgs.
Every project belongs to either a personal workspace or an org workspace.

### Navigation Flow
```
Projects Home
├── Personal (default workspace, your own projects)
├── Crunchy Bananas (org workspace)
│   ├── Shared projects visible to all members
│   └── Role-based access (owner, editor, viewer)
└── Another Org...
```

### Workspace Switcher (Left sidebar or dropdown)
Like Slack/Notion/Linear - a workspace switcher in the nav:
- Your avatar + "Personal" (default)
- Org avatars with names
- "+ Create Organization" at the bottom
- Active workspace is highlighted

When you switch workspace, the project grid shows that workspace's projects.

## UX Screens

### 1. Workspace Switcher (Projects Home Nav)
```
┌─────────────────────────────┐
│ ✦ Atelier        [+ New]   │
│─────────────────────────────│
│ [👤] Personal          ← ● │ (active)
│ [🍌] Crunchy Bananas       │
│ [🎨] Design Team           │
│─────────────────────────────│
│ + Create Organization       │
└─────────────────────────────┘
```

### 2. Organization Settings Page (#/org/{orgId}/settings)
- Rename org
- Upload org avatar/icon
- Members list with roles (Owner, Editor, Viewer)
- Invite by email
- Remove members
- Delete organization (owner only)

### 3. Invite Flow
- Owner clicks "Invite" in org settings
- Enter email address
- Select role (Editor or Viewer)
- Sends invite (stored in Firestore, no email needed for MVP - just a pending invite)
- Invitee sees the org appear in their workspace switcher on next login
- Accept/decline invite

### 4. Project Sharing within Org
- All projects in an org workspace are visible to all org members
- Editors can modify, Viewers can only view
- Project cards show who last edited ("Edited by Cory, 2h ago")
- In the editor, show other org members' avatars in topbar (presence indicator)

### 5. Share Individual Project (Outside Org)
- "Share" button in editor topbar
- Share modal: enter email, set permission (edit/view)
- Generates a link: `https://atelier-eac0b.web.app/#/editor/{projectId}`
- Shared projects appear under "Shared with me" tab on the recipient's home

## Firestore Data Model

```
organizations/{orgId}
  name: string
  avatarUrl: string | null
  ownerId: string
  createdAt: Timestamp

organizations/{orgId}/members/{userId}
  role: "owner" | "editor" | "viewer"
  joinedAt: Timestamp
  email: string

organizations/{orgId}/invites/{inviteId}
  email: string
  role: "editor" | "viewer"
  invitedBy: string
  createdAt: Timestamp
  status: "pending" | "accepted" | "declined"

projects/{projectId}
  name: string
  ownerId: string
  orgId: string | null          // null = personal workspace
  collaboratorIds: string[]     // for individual sharing
  createdAt: Timestamp
  updatedAt: Timestamp
  lastEditedBy: string | null
  elements: DesignElement[]
```

### Security Rules
```
// Org members can read org data
match /organizations/{orgId} {
  allow read: if isOrgMember(orgId);
  allow create: if request.auth != null;
  allow update, delete: if isOrgOwner(orgId);
}

// Projects: owner OR org member OR collaborator
match /projects/{projectId} {
  allow read: if isProjectOwner() || isOrgMember(resource.data.orgId) || isCollaborator();
  allow create: if request.auth != null;
  allow update: if isProjectOwner() || isOrgEditor(resource.data.orgId) || isEditCollaborator();
  allow delete: if isProjectOwner() || isOrgOwner(resource.data.orgId);
}
```

## Implementation Phases

### Phase 1: Workspace Switcher + Org CRUD
- Workspace switcher dropdown in projects home nav
- Create org modal (name only)
- Org shows in switcher
- Filter projects by orgId
- Creating project in an org sets orgId

### Phase 2: Members + Invites
- Org settings page
- Invite by email (Firestore-only, no email service)
- Accept/decline invites
- Member list with role badges
- Remove member

### Phase 3: Project Sharing
- Share button in editor topbar
- Share modal with email + role picker
- "Shared with me" tab on projects home
- Presence avatars in editor topbar (mocked initially)

### Phase 4: Real-time Collaboration (Future)
- Firestore onSnapshot for live element sync
- Cursor presence via Firestore
- Element locking during editing
- Change attribution ("Cory moved Rectangle 1")
