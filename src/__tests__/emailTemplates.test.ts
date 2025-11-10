import { brandedEmailHTML } from '@/lib/emailTemplates';

describe('brandedEmailHTML', () => {
  it('includes logo, preheader, and manage link', () => {
    const html = brandedEmailHTML({
      title: 'Sample Event',
      minutes: 30,
      startsAt: '2025-11-07 10:00 AM',
      galleryId: 123,
      email: 'user@example.com',
    });

    expect(html).toContain('display:none'); // preheader block
    expect(html).toContain('/brand-logos/danceman.png'); // logo path
    expect(html).toContain('Manage reminders or unsubscribe'); // footer copy
    expect(html).toContain('/moments/rsvp/');
    expect(html).toContain('prefillEmail=user%40example.com');
    expect(html).toContain('Open Moments');
  });
});
