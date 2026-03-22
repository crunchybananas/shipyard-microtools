import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  setDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";
import type { DesignElement } from "atelier/services/design-store";

export interface FirestoreProject {
  id: string;
  name: string;
  ownerId: string;
  orgId: string | null;
  createdAt: string;
  updatedAt: string;
  elementCount: number;
  collaboratorIds: string[];
  collaboratorEmails: string[];
}

interface FirestoreProjectDoc {
  name: string;
  ownerId: string;
  orgId: string | null;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  updatedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  elementCount: number;
  elements: DesignElement[];
  collaboratorIds: string[];
  collaboratorEmails: string[];
}

export interface FirestoreOrg {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface FirestoreOrgMember {
  userId: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
  email: string;
}

export interface FirestoreInvite {
  id: string;
  email: string;
  role: "editor" | "viewer";
  invitedBy: string;
  createdAt: string;
  status: "pending" | "accepted" | "declined";
}

function timestampToISO(ts: Timestamp | null | undefined): string {
  if (!ts || !(ts instanceof Timestamp)) return new Date().toISOString();
  return ts.toDate().toISOString();
}

// ==========================================
// Projects
// ==========================================

export async function listProjects(userId: string, orgId?: string | null): Promise<FirestoreProject[]> {
  let q;
  if (orgId) {
    q = query(
      collection(db, "projects"),
      where("orgId", "==", orgId),
      orderBy("updatedAt", "desc"),
    );
  } else {
    q = query(
      collection(db, "projects"),
      where("ownerId", "==", userId),
      where("orgId", "==", null),
      orderBy("updatedAt", "desc"),
    );
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as FirestoreProjectDoc;
    return {
      id: docSnap.id,
      name: data.name,
      ownerId: data.ownerId,
      orgId: data.orgId ?? null,
      createdAt: timestampToISO(data.createdAt as Timestamp),
      updatedAt: timestampToISO(data.updatedAt as Timestamp),
      elementCount: data.elementCount ?? 0,
      collaboratorIds: data.collaboratorIds ?? [],
      collaboratorEmails: data.collaboratorEmails ?? [],
    };
  });
}

export async function listSharedProjects(email: string): Promise<FirestoreProject[]> {
  const q = query(
    collection(db, "projects"),
    where("collaboratorEmails", "array-contains", email),
    orderBy("updatedAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as FirestoreProjectDoc;
    return {
      id: docSnap.id,
      name: data.name,
      ownerId: data.ownerId,
      orgId: data.orgId ?? null,
      createdAt: timestampToISO(data.createdAt as Timestamp),
      updatedAt: timestampToISO(data.updatedAt as Timestamp),
      elementCount: data.elementCount ?? 0,
      collaboratorIds: data.collaboratorIds ?? [],
      collaboratorEmails: data.collaboratorEmails ?? [],
    };
  });
}

export async function getProject(
  projectId: string,
): Promise<{ project: FirestoreProject; elements: DesignElement[] } | null> {
  const docRef = doc(db, "projects", projectId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;

  const data = docSnap.data() as FirestoreProjectDoc;
  return {
    project: {
      id: docSnap.id,
      name: data.name,
      ownerId: data.ownerId,
      orgId: data.orgId ?? null,
      createdAt: timestampToISO(data.createdAt as Timestamp),
      updatedAt: timestampToISO(data.updatedAt as Timestamp),
      elementCount: data.elementCount ?? 0,
      collaboratorIds: data.collaboratorIds ?? [],
      collaboratorEmails: data.collaboratorEmails ?? [],
    },
    elements: data.elements ?? [],
  };
}

export async function createProject(
  userId: string,
  name: string,
  elements: DesignElement[] = [],
  orgId: string | null = null,
): Promise<string> {
  const docRef = await addDoc(collection(db, "projects"), {
    name,
    ownerId: userId,
    orgId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    elementCount: elements.length,
    elements,
    collaboratorIds: [],
    collaboratorEmails: [],
  } as FirestoreProjectDoc);
  return docRef.id;
}

export async function saveProject(
  projectId: string,
  elements: DesignElement[],
): Promise<void> {
  const docRef = doc(db, "projects", projectId);
  await updateDoc(docRef, {
    elements,
    elementCount: elements.length,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  const docRef = doc(db, "projects", projectId);
  await deleteDoc(docRef);
}

export async function shareProject(projectId: string, email: string): Promise<void> {
  const docRef = doc(db, "projects", projectId);
  await updateDoc(docRef, {
    collaboratorEmails: arrayUnion(email),
    updatedAt: serverTimestamp(),
  });
}

export async function unshareProject(projectId: string, email: string): Promise<void> {
  const docRef = doc(db, "projects", projectId);
  await updateDoc(docRef, {
    collaboratorEmails: arrayRemove(email),
    updatedAt: serverTimestamp(),
  });
}

export async function getProjectCollaborators(projectId: string): Promise<string[]> {
  const docRef = doc(db, "projects", projectId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return [];
  const data = docSnap.data() as FirestoreProjectDoc;
  return data.collaboratorEmails ?? [];
}

// ==========================================
// Organizations
// ==========================================

export async function createOrg(userId: string, name: string, email: string): Promise<string> {
  const orgRef = await addDoc(collection(db, "organizations"), {
    name,
    ownerId: userId,
    createdAt: serverTimestamp(),
  });

  // Add creator as owner member
  await setDoc(doc(db, "organizations", orgRef.id, "members", userId), {
    role: "owner",
    joinedAt: serverTimestamp(),
    email,
  });

  return orgRef.id;
}

export async function deleteOrg(orgId: string): Promise<void> {
  // Delete members subcollection
  const membersSnap = await getDocs(collection(db, "organizations", orgId, "members"));
  for (const memberDoc of membersSnap.docs) {
    await deleteDoc(memberDoc.ref);
  }
  // Delete invites subcollection
  const invitesSnap = await getDocs(collection(db, "organizations", orgId, "invites"));
  for (const inviteDoc of invitesSnap.docs) {
    await deleteDoc(inviteDoc.ref);
  }
  // Delete org doc
  await deleteDoc(doc(db, "organizations", orgId));
}

export async function updateOrg(orgId: string, updates: { name?: string }): Promise<void> {
  const docRef = doc(db, "organizations", orgId);
  await updateDoc(docRef, updates);
}

export async function listUserOrgs(userId: string): Promise<FirestoreOrg[]> {
  // For MVP: query all organizations, then check if user is a member of each.
  // This is simple and works well at small scale.
  const orgsSnapshot = await getDocs(collection(db, "organizations"));
  const orgs: FirestoreOrg[] = [];

  for (const orgDoc of orgsSnapshot.docs) {
    const memberRef = doc(db, "organizations", orgDoc.id, "members", userId);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      const data = orgDoc.data();
      orgs.push({
        id: orgDoc.id,
        name: data.name,
        ownerId: data.ownerId,
        createdAt: timestampToISO(data.createdAt as Timestamp),
      });
    }
  }

  return orgs;
}

export async function getOrgMembers(orgId: string): Promise<FirestoreOrgMember[]> {
  const membersSnap = await getDocs(collection(db, "organizations", orgId, "members"));
  return membersSnap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      userId: docSnap.id,
      role: data.role,
      joinedAt: timestampToISO(data.joinedAt as Timestamp),
      email: data.email ?? "",
    };
  });
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, "organizations", orgId, "members", userId));
}

export async function addMember(orgId: string, userId: string, email: string, role: "editor" | "viewer"): Promise<void> {
  await setDoc(doc(db, "organizations", orgId, "members", userId), {
    role,
    joinedAt: serverTimestamp(),
    email,
  });
}

// ==========================================
// Invites
// ==========================================

export async function createInvite(orgId: string, email: string, role: "editor" | "viewer", invitedBy: string): Promise<string> {
  const inviteRef = await addDoc(collection(db, "organizations", orgId, "invites"), {
    email,
    role,
    invitedBy,
    createdAt: serverTimestamp(),
    status: "pending",
  });
  return inviteRef.id;
}

export async function getInvites(orgId: string): Promise<FirestoreInvite[]> {
  const invitesSnap = await getDocs(
    query(collection(db, "organizations", orgId, "invites"), orderBy("createdAt", "desc")),
  );
  return invitesSnap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      email: data.email,
      role: data.role,
      invitedBy: data.invitedBy,
      createdAt: timestampToISO(data.createdAt as Timestamp),
      status: data.status,
    };
  });
}

export async function acceptInvite(orgId: string, inviteId: string, userId: string, email: string): Promise<void> {
  // Update invite status
  const inviteRef = doc(db, "organizations", orgId, "invites", inviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) return;

  const inviteData = inviteSnap.data();
  await updateDoc(inviteRef, { status: "accepted" });

  // Add user as member
  await setDoc(doc(db, "organizations", orgId, "members", userId), {
    role: inviteData.role,
    joinedAt: serverTimestamp(),
    email,
  });
}

export async function checkPendingInvites(email: string): Promise<{ orgId: string; inviteId: string; orgName: string }[]> {
  // Check all orgs for pending invites matching this email
  const orgsSnap = await getDocs(collection(db, "organizations"));
  const pendingInvites: { orgId: string; inviteId: string; orgName: string }[] = [];

  for (const orgDoc of orgsSnap.docs) {
    const invitesQuery = query(
      collection(db, "organizations", orgDoc.id, "invites"),
      where("email", "==", email),
      where("status", "==", "pending"),
    );
    const invitesSnap = await getDocs(invitesQuery);
    for (const inviteDoc of invitesSnap.docs) {
      pendingInvites.push({
        orgId: orgDoc.id,
        inviteId: inviteDoc.id,
        orgName: orgDoc.data().name,
      });
    }
  }

  return pendingInvites;
}

export async function deleteInvite(orgId: string, inviteId: string): Promise<void> {
  await deleteDoc(doc(db, "organizations", orgId, "invites", inviteId));
}
