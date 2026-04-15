import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import ChannelHeader from "harbor-chat/components/harbor-chat/channel-header";
import MessageList from "harbor-chat/components/harbor-chat/message-list";
import MessageComposer from "harbor-chat/components/harbor-chat/message-composer";
import ThreadPanel from "harbor-chat/components/harbor-chat/thread-panel";
import MemberList from "harbor-chat/components/harbor-chat/member-list";
import SearchPanel from "harbor-chat/components/harbor-chat/search-panel";

class ChannelView extends Component {
  @tracked isSearchOpen = false;

  get hasChannel(): boolean {
    return !!this.args.model?.channel?.id;
  }

  toggleSearch = () => {
    this.isSearchOpen = !this.isSearchOpen;
  };

  closeSearch = () => {
    this.isSearchOpen = false;
  };

  <template>
    {{#if this.hasChannel}}
      <ChannelHeader
        @channel={{@model.channel}}
        @memberCount={{@model.members.length}}
        @onToggleSearch={{this.toggleSearch}}
        @isSearchOpen={{this.isSearchOpen}}
      />
      <div class="content-area">
        <div class="messages-area">
          <MessageList @channel={{@model.channel}} />
          <MessageComposer @channel={{@model.channel}} />
        </div>
        <ThreadPanel @channelId={{@model.channel.id}} @channel={{@model.channel}} />
        {{#if this.isSearchOpen}}
          <SearchPanel
            @isOpen={{this.isSearchOpen}}
            @onClose={{this.closeSearch}}
            @channelId={{@model.channel.id}}
          />
        {{/if}}
        <MemberList
          @members={{@model.members}}
          @workspaceId={{@model.workspace.workspace.id}}
        />
      </div>
    {{else}}
      <div class="loading-screen">
        <div class="loading-content">
          <div class="loading-bar"><div class="loading-bar-fill"></div></div>
        </div>
      </div>
    {{/if}}
  </template>
}

<template><ChannelView @model={{@model}} /></template>
