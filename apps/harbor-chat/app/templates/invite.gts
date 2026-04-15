import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { on } from "@ember/modifier";
import type RouterService from "@ember/routing/router-service";
import type AuthService from "harbor-chat/services/auth-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import { acceptInvite } from "harbor-chat/utils/firestore-adapter";

class InviteLanding extends Component {
  @service declare router: RouterService;
  @service declare authService: AuthService;
  @service declare workspaceStore: WorkspaceStoreService;

  @tracked mode: "signin" | "signup" = "signup";
  @tracked emailInput = "";
  @tracked passwordInput = "";
  @tracked isSubmitting = false;

  get invite() {
    return this.args.model?.invite;
  }

  get error() {
    return this.args.model?.error;
  }

  get hasInvite(): boolean {
    return !!this.invite && !this.error;
  }

  get toggleLabel(): string {
    return this.mode === "signup"
      ? "Already have an account? Sign in"
      : "Don't have an account? Create one";
  }

  get buttonLabel(): string {
    if (this.isSubmitting) return "...";
    return this.mode === "signup" ? "Create Account & Join" : "Sign In & Join";
  }

  toggleMode = () => {
    this.mode = this.mode === "signup" ? "signin" : "signup";
    this.authService.error = null;
  };

  handleEmail = (e: Event) => {
    this.emailInput = (e.target as HTMLInputElement).value;
  };

  handlePassword = (e: Event) => {
    this.passwordInput = (e.target as HTMLInputElement).value;
  };

  signInWithGoogle = async () => {
    this.isSubmitting = true;
    await this.authService.signInWithGoogle();
    if (this.authService.isAuthenticated) {
      await this._acceptAndRedirect();
    }
    this.isSubmitting = false;
  };

  submitEmail = async (e: Event) => {
    e.preventDefault();
    if (!this.emailInput || !this.passwordInput) return;
    this.isSubmitting = true;

    if (this.mode === "signup") {
      await this.authService.signUpWithEmail(this.emailInput, this.passwordInput);
    } else {
      await this.authService.signInWithEmail(this.emailInput, this.passwordInput);
    }

    if (this.authService.isAuthenticated) {
      await this._acceptAndRedirect();
    }
    this.isSubmitting = false;
  };

  private async _acceptAndRedirect() {
    if (!this.invite || !this.authService.uid) return;
    try {
      await acceptInvite(
        this.invite.id,
        this.invite.workspaceId,
        this.authService.uid,
      );
      await this.workspaceStore.reload();
      this.router.transitionTo("workspace", this.invite.workspaceId);
    } catch {
      // Invite may already be accepted — just redirect
      this.router.transitionTo("index");
    }
  }

  <template>
    <div class="login-screen">
      <div class="login-card">
        {{#if this.error}}
          <div class="login-header">
            <span class="login-logo">⚓</span>
            <h1>Harbor Chat</h1>
          </div>
          <div class="invite-error-msg">{{this.error}}</div>
          <a class="invite-home-link" href="#/">Go to Harbor Chat →</a>

        {{else if this.hasInvite}}
          <div class="login-header">
            <span class="login-logo">⚓</span>
            <h1>You're invited!</h1>
            <p class="login-subtitle">
              <strong>{{this.invite.invitedByName}}</strong> invited you to join
            </p>
            <div class="invite-workspace-badge">{{this.invite.workspaceName}}</div>
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

          <div class="login-divider"><span>or</span></div>

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
              autocomplete={{if (this.isSignUp) "new-password" "current-password"}}
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

        {{else}}
          <div class="login-header">
            <span class="login-logo">⚓</span>
            <h1>Harbor Chat</h1>
            <p class="login-subtitle">Loading invite...</p>
          </div>
        {{/if}}
      </div>
    </div>
  </template>

  get isSignUp(): boolean {
    return this.mode === "signup";
  }
}

<template><InviteLanding @model={{@model}} /></template>
