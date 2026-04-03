from django.contrib import admin

from .models import Conversation, Message, UserChatMemory


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "title", "agent_relationship_stage", "updated_at")
    inlines = [MessageInline]


@admin.register(UserChatMemory)
class UserChatMemoryAdmin(admin.ModelAdmin):
    list_display = ("user", "preferred_name", "user_message_count", "updated_at")
