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
} from "firebase/firestore";
import { db } from "./firebase";
import type { DesignElement } from "atelier/services/design-store";

export interface FirestoreProject {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  elementCount: number;
}

interface FirestoreProjectDoc {
  name: string;
  ownerId: string;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  updatedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  elementCount: number;
  elements: DesignElement[];
}

function timestampToISO(ts: Timestamp | null | undefined): string {
  if (!ts || !(ts instanceof Timestamp)) return new Date().toISOString();
  return ts.toDate().toISOString();
}

export async function listProjects(userId: string): Promise<FirestoreProject[]> {
  const q = query(
    collection(db, "projects"),
    where("ownerId", "==", userId),
    orderBy("updatedAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as FirestoreProjectDoc;
    return {
      id: docSnap.id,
      name: data.name,
      ownerId: data.ownerId,
      createdAt: timestampToISO(data.createdAt as Timestamp),
      updatedAt: timestampToISO(data.updatedAt as Timestamp),
      elementCount: data.elementCount ?? 0,
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
      createdAt: timestampToISO(data.createdAt as Timestamp),
      updatedAt: timestampToISO(data.updatedAt as Timestamp),
      elementCount: data.elementCount ?? 0,
    },
    elements: data.elements ?? [],
  };
}

export async function createProject(
  userId: string,
  name: string,
  elements: DesignElement[] = [],
): Promise<string> {
  const docRef = await addDoc(collection(db, "projects"), {
    name,
    ownerId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    elementCount: elements.length,
    elements,
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
