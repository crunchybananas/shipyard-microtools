import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { on } from "@ember/modifier";
import type AuthService from "harbor-chat/services/auth-service";

export default class LoginScreen extends Component {
  @service declare authService: AuthService;

  @tracked mode: "signin" | "signup" = "signin";
  @tracked emailInput = "";
  @tracked passwordInput = "";
  @tracked isSubmitting = false;

  get isSignUp(): boolean {
    return this.mode === "signup";
  }

  get buttonLabel(): string {
    if (this.isSubmitting) return "...";
    return this.isSignUp ? "Create Account" : "Sign In";
  }

  get toggleLabel(): string {
    return this.isSignUp
      ? "Already have an account? Sign in"
      : "Don't have an account? Create one";
  }

  handleEmail = (e: Event) => {
    this.emailInput = (e.target as HTMLInputElement).value;
  };

  handlePassword = (e: Event) => {
    this.passwordInput = (e.target as HTMLInputElement).value;
  };

  toggleMode = () => {
    this.mode = this.isSignUp ? "signin" : "signup";
    this.authService.error = null;
  };

  signInWithGoogle = async () => {
    this.isSubmitting = true;
    await this.authService.signInWithGoogle();
    this.isSubmitting = false;
  };

  submitEmail = async (e: Event) => {
    e.preventDefault();
    if (!this.emailInput || !this.passwordInput) return;
    this.isSubmitting = true;
    if (this.isSignUp) {
      await this.authService.signUpWithEmail(this.emailInput, this.passwordInput);
    } else {
      await this.authService.signInWithEmail(this.emailInput, this.passwordInput);
    }
    this.isSubmitting = false;
  };

  <template>
    <div class="login-screen">
      <div class="login-card">
        <div class="login-header">
          <span class="login-logo">⚓</span>
          <h1>Harbor Chat</h1>
          <p class="login-subtitle">Encrypted team messaging</p>
        </div>

        <button class="login-google-btn" {{on "click" this.signInWithGoogle}} disabled={{this.isSubmitting}}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div class="login-divider">
          <span>or</span>
        </div>

        <form {{on "submit" this.submitEmail}}>
          <input
            class="login-input"
            type="email"
            placeholder="Email"
            value={{this.emailInput}}
            autocomplete="email"
            {{on "input" this.handleEmail}}
          />
          <input
            class="login-input"
            type="password"
            placeholder="Password"
            value={{this.passwordInput}}
            autocomplete={{if this.isSignUp "new-password" "current-password"}}
            {{on "input" this.handlePassword}}
          />
          <button class="login-submit-btn" type="submit" disabled={{this.isSubmitting}}>
            {{this.buttonLabel}}
          </button>
        </form>

        {{#if this.authService.error}}
          <div class="login-error">{{this.authService.error}}</div>
        {{/if}}

        <button class="login-toggle" {{on "click" this.toggleMode}}>
          {{this.toggleLabel}}
        </button>
      </div>
    </div>
  </template>
}
