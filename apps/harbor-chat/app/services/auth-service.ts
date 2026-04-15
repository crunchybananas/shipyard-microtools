import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { auth } from "harbor-chat/utils/firebase";

/**
 * Wraps Firebase Auth as an Ember service.
 * Follows the same pattern as atelier's auth-service.
 *
 * Listens to onAuthStateChanged so @tracked properties
 * auto-update the UI when auth state changes.
 */
export default class AuthService extends Service {
  @tracked currentUser: User | null = null;
  @tracked isLoading: boolean = true;
  @tracked error: string | null = null;

  private _unsubscribe: (() => void) | null = null;
  private _authReadyResolve: (() => void) | null = null;
  authReady: Promise<void>;

  constructor(properties: object | undefined) {
    super(properties);

    this.authReady = new Promise((resolve) => {
      this._authReadyResolve = resolve;
    });

    this._unsubscribe = onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.isLoading = false;
      if (this._authReadyResolve) {
        this._authReadyResolve();
        this._authReadyResolve = null;
      }
    });
  }

  willDestroy(): void {
    super.willDestroy();
    if (this._unsubscribe) {
      this._unsubscribe();
    }
  }

  get isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  get displayName(): string | null {
    return this.currentUser?.displayName ?? null;
  }

  get email(): string | null {
    return this.currentUser?.email ?? null;
  }

  get photoURL(): string | null {
    return this.currentUser?.photoURL ?? null;
  }

  get uid(): string | null {
    return this.currentUser?.uid ?? null;
  }

  get initials(): string {
    const name = this.displayName || this.email || "";
    if (!name) return "?";
    const parts = name.split(/[\s@]+/);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    }
    return name[0]!.toUpperCase();
  }

  async signInWithGoogle(): Promise<void> {
    this.error = null;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/popup-closed-by-user") return;
      this.error = err.message ?? "Sign-in failed. Please try again.";
    }
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    this.error = null;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        this.error = "Invalid email or password.";
      } else if (err.code === "auth/user-not-found") {
        this.error = "No account found with that email.";
      } else if (err.code === "auth/too-many-requests") {
        this.error = "Too many attempts. Please try again later.";
      } else {
        this.error = err.message ?? "Sign-in failed. Please try again.";
      }
    }
  }

  async signUpWithEmail(email: string, password: string): Promise<void> {
    this.error = null;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/email-already-in-use") {
        this.error = "An account already exists with that email.";
      } else if (err.code === "auth/weak-password") {
        this.error = "Password must be at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        this.error = "Please enter a valid email address.";
      } else {
        this.error = err.message ?? "Sign-up failed. Please try again.";
      }
    }
  }

  async signOut(): Promise<void> {
    this.error = null;
    try {
      await firebaseSignOut(auth);
    } catch (e: unknown) {
      const err = e as { message?: string };
      this.error = err.message ?? "Sign-out failed.";
    }
  }
}
