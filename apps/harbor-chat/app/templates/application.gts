import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import type AuthService from "harbor-chat/services/auth-service";
import type RouterService from "@ember/routing/router-service";
import LoginScreen from "harbor-chat/components/harbor-chat/login-screen";

class ApplicationLayout extends Component {
  @service declare authService: AuthService;
  @service declare router: RouterService;

  get isInviteRoute(): boolean {
    return this.router.currentRouteName?.startsWith("invite") ?? false;
  }

  <template>
    {{#if this.authService.isLoading}}
      <div class="loading-screen">
        <div class="loading-content">
          <span class="loading-logo">⚓</span>
          <h2 class="loading-title">Harbor Chat</h2>
          <div class="loading-bar">
            <div class="loading-bar-fill"></div>
          </div>
        </div>
      </div>
    {{else if this.isInviteRoute}}
      {{outlet}}
    {{else if this.authService.isAuthenticated}}
      {{outlet}}
    {{else}}
      <LoginScreen />
    {{/if}}
  </template>
}

<template><ApplicationLayout /></template>
