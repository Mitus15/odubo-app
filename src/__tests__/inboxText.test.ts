/**
 * The pure parts of the inbox. Everything that decides which thread an email
 * belongs to, and how a reply is cut down to the part the customer wrote.
 */
import {
  cleanSubject,
  fillTemplate,
  header,
  isAutomatedMail,
  normalizeEmail,
  normalizeOrderNumber,
  outboundMessageId,
  parseAddress,
  parseMessageIds,
  plusAddress,
  snippet,
  stripQuotedReply,
  tokenFromAddress,
  tokenFromRecipients,
} from '@/lib/inbox/text';

describe('addresses', () => {
  it('parses a display-name address and a bare one', () => {
    expect(parseAddress('Odubo Studio <Support@OduboStudio.com>')).toEqual({ name: 'Odubo Studio', address: 'support@odubostudio.com' });
    expect(parseAddress('  Jane@Example.com ')).toEqual({ name: null, address: 'jane@example.com' });
    expect(parseAddress('"Doe, Jane" <jane@example.com>')).toEqual({ name: 'Doe, Jane', address: 'jane@example.com' });
  });

  it('lowercases on the way in so the unique contact key holds', () => {
    expect(normalizeEmail(' Jane@Example.COM ')).toBe('jane@example.com');
  });

  it('builds the plus-address a thread answers to', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
    expect(plusAddress('Odubo Studio <support@odubostudio.com>', token)).toBe(`support+${token}@odubostudio.com`);
  });

  it('finds the token in any recipient, and ignores addresses that are not ours', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
    expect(tokenFromAddress(`support+${token}@odubostudio.com`)).toBe(token);
    expect(tokenFromAddress('support@odubostudio.com')).toBeNull();
    expect(tokenFromAddress('jane+promo@gmail.com')).toBeNull();
    expect(tokenFromRecipients(['hello@odubostudio.com', `Odubo <support+${token}@odubostudio.com>`])).toBe(token);
  });
});

describe('message ids', () => {
  it('stamps outbound mail with an id on the sending domain', () => {
    expect(outboundMessageId('m1', 'Odubo Studio <support@odubostudio.com>')).toBe('<inbox.m1@odubostudio.com>');
  });

  it('reads one or many ids out of In-Reply-To and References', () => {
    expect(parseMessageIds(undefined)).toEqual([]);
    expect(parseMessageIds('<a@x>')).toEqual(['<a@x>']);
    expect(parseMessageIds('<a@x> <b@y>,<c@z> <a@x>')).toEqual(['<a@x>', '<b@y>', '<c@z>']);
  });

  it('looks headers up either shape, case-insensitively', () => {
    expect(header({ 'In-Reply-To': '<a@x>' }, 'in-reply-to')).toBe('<a@x>');
    expect(header([{ name: 'references', value: '<a@x> <b@y>' }], 'References')).toBe('<a@x> <b@y>');
    expect(header(null, 'x')).toBeNull();
  });
});

describe('automated mail', () => {
  it('keeps bounces and vacation responders out of the inbox', () => {
    expect(isAutomatedMail({ 'Auto-Submitted': 'auto-replied' }, 'jane@example.com')).toBe(true);
    expect(isAutomatedMail({ Precedence: 'bulk' }, 'jane@example.com')).toBe(true);
    expect(isAutomatedMail({}, 'MAILER-DAEMON@mx.google.com')).toBe(true);
    expect(isAutomatedMail({ 'X-Auto-Response-Suppress': 'All' }, 'jane@example.com')).toBe(true);
  });

  it('lets a real reply through, including Auto-Submitted: no', () => {
    expect(isAutomatedMail({ 'Auto-Submitted': 'no' }, 'jane@example.com')).toBe(false);
    expect(isAutomatedMail({}, 'jane@example.com')).toBe(false);
  });
});

describe('stripQuotedReply', () => {
  it('cuts Gmail quoting', () => {
    const text = 'Yes please, the black one.\n\nOn Mon, Sep 14, 2026 at 9:02 AM Odubo Studio <support@odubostudio.com> wrote:\n> Which colour did you want?\n> Mani';
    expect(stripQuotedReply(text)).toBe('Yes please, the black one.');
  });

  it('cuts Outlook quoting', () => {
    const text = 'Sounds good.\r\n\r\nFrom: Odubo Studio\r\nSent: Monday\r\nTo: me\r\nSubject: Re: order\r\n\r\nold text';
    expect(stripQuotedReply(text)).toBe('Sounds good.');
  });

  it('cuts a signature rule and trailing > lines', () => {
    expect(stripQuotedReply('Thanks!\n-- \nJane Doe\nSent from my phone')).toBe('Thanks!');
    expect(stripQuotedReply('Thanks!\n\n> earlier\n> more\n')).toBe('Thanks!');
  });

  it('leaves a message with no quoting alone', () => {
    expect(stripQuotedReply('Hi,\n\nIs the hoodie back in stock?\n\nJane')).toBe('Hi,\n\nIs the hoodie back in stock?\n\nJane');
  });
});

describe('small helpers', () => {
  it('drops the Re: pile', () => {
    expect(cleanSubject('Re: RE: Fwd: Order inquiry')).toBe('Order inquiry');
    expect(cleanSubject('')).toBeNull();
  });

  it('reads an order number however it was typed', () => {
    expect(normalizeOrderNumber('#1234')).toBe('1234');
    expect(normalizeOrderNumber('Order 1234 please')).toBe('1234');
    expect(normalizeOrderNumber('n/a')).toBeNull();
  });

  it('snips to one line', () => {
    expect(snippet('a\n\nb   c', 10)).toBe('a b c');
    expect(snippet('x'.repeat(20), 10)).toHaveLength(10);
  });

  it('fills a template with the first name and the order', () => {
    expect(fillTemplate('Hi {name}, about {order}.', { name: 'Jane Doe', order: '1234' })).toBe('Hi Jane, about #1234.');
    expect(fillTemplate('Hi {name}, about {order}.', { name: null, order: null })).toBe('Hi there, about your order.');
  });
});
