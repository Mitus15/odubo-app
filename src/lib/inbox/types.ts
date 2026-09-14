/**
 * The inbox's shapes, shared by the store, the admin and the customer's page.
 */

export type InboxTopic = 'order' | 'refund' | 'shipping' | 'general';
export type InboxStatus = 'open' | 'waiting' | 'closed';
export type InboxDirection = 'in' | 'out' | 'note';
export type InboxChannel = 'web' | 'email' | 'sms';
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'received';

export const INBOX_TOPICS: InboxTopic[] = ['order', 'refund', 'shipping', 'general'];
export const INBOX_STATUSES: InboxStatus[] = ['open', 'waiting', 'closed'];

export const TOPIC_LABELS: Record<InboxTopic, string> = {
  order: 'Order',
  refund: 'Return',
  shipping: 'Shipping',
  general: 'General',
};

export interface InboxContact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  customer_id: string | null;
  notes: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface InboxThread {
  id: string;
  contact_id: string;
  token: string;
  subject: string | null;
  topic: InboxTopic;
  status: InboxStatus;
  order_number: string | null;
  last_message_at: string;
  last_direction: 'in' | 'out';
  unread_count: number;
  ack_message_id: string | null;
  references_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboxMessage {
  id: string;
  thread_id: string;
  direction: InboxDirection;
  channel: InboxChannel;
  body_text: string;
  body_html: string | null;
  from_email: string | null;
  resend_email_id: string | null;
  provider_message_id: string | null;
  submission_id: string | null;
  delivery_status: DeliveryStatus;
  delivery_error: string | null;
  author_user_id: string | null;
  created_at: string;
}

export interface InboxAttachment {
  id: string;
  message_id: string;
  filename: string | null;
  content_type: string | null;
  size: number | null;
  download_url: string | null;
  expires_at: string | null;
}

/** A row in the admin list: the thread plus what the list needs to say about it. */
export interface ThreadListRow extends InboxThread {
  contact_email: string;
  contact_name: string | null;
  last_snippet: string | null;
}

export interface CustomerOrderRow {
  id: string;
  order_number: number | null;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
}

export interface LoopCodeRow {
  event_id: string;
  code: string;
  redeemed: boolean;
  created_at: number;
}

export interface ThreadDetail {
  thread: InboxThread;
  contact: InboxContact;
  messages: InboxMessage[];
  attachments: InboxAttachment[];
  orders: CustomerOrderRow[];
  loopCodes: LoopCodeRow[];
  priorThreads: Pick<InboxThread, 'id' | 'subject' | 'topic' | 'status' | 'last_message_at'>[];
}

export interface ReplyTemplate {
  id: string;
  topic: InboxTopic | 'any';
  title: string;
  body: string;
}
