# Harbor Chat — Slack Killer Plan

## Status: All 5 Phases + Agent-Native Features Deployed
Live at: https://harbor-7f970.web.app

## Current State
- Auth (Google + email/password) with login screen
- Firestore backend with rules + indexes deployed
- Workspace seeding on first sign-in
- Invite system (send by email, auto-accept on sign-in)

### Agent-Native Features (the differentiator)
- **Markdown with syntax highlighting** — `marked` + `highlight.js` with 25+ languages (JS, TS, Python, Rust, Go, etc.)
- **Structured message types** — task cards, PR summaries, deploy status, alerts, agent updates
- **Slash commands** — `/task`, `/pr`, `/deploy`, `/alert`, `/agent`, `/code` with autocomplete
- **Bot user identity** — bot users get 🤖 BOT badge, distinct purple avatar styling
- **Task cards** — inline interactive task status (todo → in-progress → done)
- **Deploy cards** — environment, status pill, commit hash, link
- **Alert cards** — severity levels (info/warning/error/critical) with color-coded borders
- **Agent update cards** — dedicated agent communication format
- Ember routing: /workspace/:id/channel/:id
- Sidebar with channels, DMs, invite panel
- Message list, composer, thread panel, member list, call overlay, profile modal
- Dark theme CSS
- Deployed to https://harbor-7f970.web.app

## What's Missing (prioritized by "wake up wowed" impact)

---

### Phase 1: Make It Actually Work (2 hours)
Everything below is broken or half-wired. Fix these first.

- [ ] **P1.1 — Real-time messages end-to-end**
  - Messages sent go to Firestore and appear live for all users via onSnapshot
  - Currently the mock path is still running even when Firebase is connected
  - Wire `sendMessage` in message-store to always use Firestore when `useMock === false`
  - Ensure `subscribeChannel()` properly updates `this.messages` reactively
  - Test: two browser tabs, send message in one, appears in other

- [ ] **P1.2 — Real typing indicators**
  - Wire the composer to call `setTyping()` on keypress (debounced)
  - Clear on send or after 3s idle
  - `subscribeToTyping()` already exists in adapter, wire it through message-store

- [ ] **P1.3 — Threads actually work with Firestore**
  - Open thread → subscribe to thread messages subcollection
  - Reply in thread → write to Firestore thread messages
  - Thread reply count updates on root message

- [ ] **P1.4 — User presence synced**
  - On sign-in, set status to "online" in Firestore
  - On window blur/focus, toggle away/online
  - On sign-out or window close, set offline (beforeunload)
  - Sidebar presence dots reflect real state

- [ ] **P1.5 — Unread counts from Firestore**
  - Track per-user last-read timestamp per channel
  - Count messages after that timestamp as unread
  - Update last-read when channel route activates
  - Show real badge counts in sidebar

---

### Phase 2: Look Like a Real App (2 hours)
Polish until it feels professional, not like a prototype.

- [ ] **P2.1 — Markdown message rendering**
  - Bold, italic, strikethrough, inline code, code blocks, links
  - No addon — write a simple parser (regex-based, ~80 lines)
  - Render as safe HTML in message-content divs
  - Auto-link URLs

- [ ] **P2.2 — Emoji picker**
  - Click the 😀 button on message actions → show emoji grid
  - Common categories: smileys, people, nature, food, objects
  - Click emoji → add reaction to message
  - In composer: type `:` to trigger inline emoji autocomplete
  - No addon — build as a component with a data array

- [ ] **P2.3 — Polished message grouping**
  - Consecutive messages from same author within 5min → collapse avatar
  - Show only time on hover for collapsed messages
  - Compact mode vs comfortable mode toggle

- [ ] **P2.4 — Image/file preview in messages**
  - If message content is a URL ending in .png/.jpg/.gif → render inline preview
  - If message has attachments → show file cards with download link
  - Lightbox on image click

- [ ] **P2.5 — Responsive/mobile layout**
  - < 768px: hide sidebar, show hamburger menu
  - Thread panel slides over instead of side-by-side
  - Touch-friendly tap targets
  - Composer doesn't get hidden by mobile keyboard

---

### Phase 3: Power Features (3 hours)
The stuff that makes people switch from Slack.

- [ ] **P3.1 — Cmd+K quick channel switcher**
  - Global keyboard shortcut opens overlay
  - Fuzzy search across channels and DMs
  - Arrow keys + enter to navigate and select
  - Shows recent channels first, then search results

- [ ] **P3.2 — @mentions with autocomplete**
  - Type `@` in composer → dropdown of workspace members
  - Filter as you type
  - Mention renders as highlighted chip in message
  - Mentioned user gets visual indicator (bold channel name / mention badge)

- [ ] **P3.3 — Message search**
  - Search icon in header → opens search panel
  - Full-text search across channel messages
  - Highlight matches in results
  - Click result → jump to message in context
  - For Firestore: use client-side filtering initially (we can add Algolia later)

- [ ] **P3.4 — Create/edit channels**
  - "+" button next to Channels header in sidebar
  - Modal: channel name, description, private toggle
  - Creates channel in Firestore, auto-joins creator
  - Edit channel description from channel header
  - Archive channel (hide from sidebar, preserve messages)

- [ ] **P3.5 — Start DM conversations**
  - "+" button next to Direct Messages in sidebar
  - Opens member picker from workspace members
  - Creates or navigates to existing DM channel
  - Group DM support (select multiple members)

- [ ] **P3.6 — Message edit and delete**
  - Hover action: edit (own messages only) → inline editor replaces content
  - Hover action: delete (own messages) → confirm then remove
  - Show "(edited)" label on edited messages
  - Deleted messages show "This message was deleted" placeholder

- [ ] **P3.7 — Pinned messages**
  - Pin button in message hover actions
  - Pinned messages show pin icon
  - "Pinned" tab in channel header → shows all pinned messages
  - Stored as a boolean + timestamp on the message doc

---

### Phase 4: Make It Feel Alive (2 hours)
The details that separate "app" from "prototype."

- [ ] **P4.1 — Link previews / unfurling**
  - When a message contains a URL, fetch Open Graph metadata
  - Show title, description, image as a card below the message
  - Use a Cloud Function or client-side fetch with CORS proxy
  - Cache unfurled data on the message doc

- [ ] **P4.2 — File upload**
  - Paperclip button in composer
  - Upload to Firebase Cloud Storage
  - Show upload progress bar
  - Attach file URL to message as attachment
  - Image files render as inline previews

- [ ] **P4.3 — Notification system**
  - Browser Notification API for mentions and DMs
  - Permission prompt on first use
  - Notification click → focus tab and navigate to channel/message
  - Unread dot on favicon

- [ ] **P4.4 — User profile editing**
  - Click own avatar → edit display name, status message
  - Upload avatar image to Cloud Storage
  - Status presets: In a meeting, Commuting, Sick, Vacationing

- [ ] **P4.5 — Workspace settings**
  - Workspace name, icon editing (owner only)
  - Member management: view all members, remove members
  - Invite link generation (share URL instead of email-only)
  - Danger zone: delete workspace

- [ ] **P4.6 — Keyboard shortcuts throughout**
  - Cmd+K: quick switcher
  - Cmd+Shift+A: all unread
  - Esc: close thread/modal/search
  - Up arrow in empty composer: edit last message
  - Cmd+/: show shortcuts cheat sheet

---

### Phase 5: Ship It (1 hour)
Final polish and deploy.

- [ ] **P5.1 — Loading states**
  - Skeleton screens while workspace data loads
  - Spinner in message list while subscribing
  - Optimistic message sending (show immediately, confirm from Firestore)

- [ ] **P5.2 — Error handling**
  - Toast notifications for send failures
  - Retry logic for Firestore writes
  - Offline indicator in header
  - Graceful fallback when Firestore is unreachable

- [ ] **P5.3 — Final UI audit**
  - Consistent spacing, font sizes, colors
  - Empty states for channels with no messages
  - "No channels" state for new workspaces
  - Favicon with unread indicator
  - Page title updates: "Harbor Chat · #general"

- [ ] **P5.4 — Performance**
  - Paginate message loading (load 50, load more on scroll up)
  - Lazy load emoji picker
  - Debounce typing indicators
  - Unsubscribe from channels/threads on route exit

- [ ] **P5.5 — Deploy**
  - Final build + Firebase Hosting deploy
  - Verify auth flow end-to-end
  - Test invite flow with fresh account
  - Test real-time messaging between two users

---

## Firebase Services Used
| Service | Purpose |
|---------|---------|
| **Authentication** | Google + Email/Password sign-in |
| **Firestore** | All data: workspaces, channels, messages, threads, users, invites, presence, typing |
| **Cloud Storage** | File uploads, avatars (Phase 4) |

## Firestore Collections Schema
```
users/{uid}
  displayName, email, avatarUrl, status, statusMessage, publicKey

workspaces/{id}
  name, icon, ownerId, memberIds[], createdAt

channels/{id}
  workspaceId, name, description, kind, memberIds[], isPrivate, createdAt, lastMessageAt
  /messages/{id}
    authorId, content, timestamp, editedAt?, threadId?, replyCount, reactions{}, attachments[], encrypted, pinned?
  /threads/{id}
    rootMessageId, participantIds[], lastReplyAt, replyCount
    /messages/{id}
      (same as channel messages)
  /typing/{uid}
    userId, timestamp
  /read/{uid}
    lastReadAt (timestamp)

invites/{id}
  workspaceId, workspaceName, email, invitedBy, invitedByName, createdAt, status
```

## Estimated Execution Order
1. P1 (2h) — Make messaging, typing, presence, unreads work for real
2. P2 (2h) — Markdown, emoji picker, message grouping, responsive
3. P3 (3h) — Cmd+K, @mentions, search, create channels, DMs, edit/delete, pins
4. P4 (2h) — Link previews, file upload, notifications, profile editing, workspace settings
5. P5 (1h) — Loading states, error handling, polish, deploy
