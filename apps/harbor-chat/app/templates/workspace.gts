import WorkspaceSwitcher from "harbor-chat/components/harbor-chat/workspace-switcher";
import Sidebar from "harbor-chat/components/harbor-chat/sidebar";
import CallOverlay from "harbor-chat/components/harbor-chat/call-overlay";
import UserProfileModal from "harbor-chat/components/harbor-chat/user-profile-modal";
import QuickSwitcher from "harbor-chat/components/harbor-chat/quick-switcher";
import ShortcutsOverlay from "harbor-chat/components/harbor-chat/shortcuts-overlay";

<template>
  <div class="harbor-chat">
    <WorkspaceSwitcher @activeWorkspaceId={{@model.workspace.id}} />
    <Sidebar
      @workspace={{@model.workspace}}
      @channels={{@model.channels}}
      @dms={{@model.dms}}
    />
    <main class="main-content">
      {{outlet}}
    </main>
    <CallOverlay />
    <UserProfileModal />
    <QuickSwitcher />
    <ShortcutsOverlay />
  </div>
</template>
