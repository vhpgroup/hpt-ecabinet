// ============================================================
// TRAO ĐỔI — tin nhắn chung phòng họp & tin nhắn riêng
// ============================================================
import { db } from '../data/db';
import { uid, type ChatMessage, type User } from '../domain/types';

export async function sendMessage(actor: User, meetingId: string, content: string, toId?: string | null) {
  const msg: ChatMessage = {
    id: uid(), meetingId, fromId: actor.id, toId: toId ?? null,
    content: content.trim(), sentAt: new Date().toISOString(),
  };
  if (!msg.content) throw new Error('Nội dung trống');
  await db.messages.create(msg);
  return msg;
}

/** Tin nhắn user được thấy trong 1 phiên họp: kênh chung + tin riêng liên quan mình */
export function visibleMessages(all: ChatMessage[], meetingId: string, userId: string) {
  return all
    .filter((m) => m.meetingId === meetingId)
    .filter((m) => m.toId === null || m.toId === userId || m.fromId === userId)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}
