'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { CrmConfigDto, EnquiryDetailDto, UserOptionDto } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { getAiActionMessage } from '@/lib/ai-errors';
import { generateEnquirySummary } from '@/lib/enquiry-ai-api';
import { userHasPermission } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CountrySelect, PhoneFields } from '@/components/ui/country-phone-fields';
import { EnquiryLeadScoreCard } from '@/components/admin/enquiry-lead-score-card';
import { EnquiryAiSummaryCard } from '@/components/admin/enquiry-ai-summary-card';
import { getCountry, nationalNumberFromE164 } from '@dsb/shared';

export default function AdminEnquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const [enquiry, setEnquiry] = useState<EnquiryDetailDto | null>(null);
  const [config, setConfig] = useState<CrmConfigDto[]>([]);
  const [users, setUsers] = useState<UserOptionDto[]>([]);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [note, setNote] = useState('');
  const [noteType, setNoteType] = useState<'agent' | 'internal_note'>('agent');
  const [contactForm, setContactForm] = useState({
    country: 'IN',
    phoneCountry: 'IN',
    phone: '',
  });

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setError('');
    try {
      const data = await apiFetchWithToken<EnquiryDetailDto>(`/admin/enquiries/${id}`, accessToken);
      setEnquiry(data);
      setContactForm({
        country: data.country,
        phoneCountry: data.phoneCountry,
        phone: nationalNumberFromE164(data.phone, data.phoneCountry),
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load enquiry.'));
    }
  }, [accessToken, id]);

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, 'Failed to load enquiry.')));
  }, [load]);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      apiFetchWithToken<CrmConfigDto[]>('/admin/crm-config', accessToken),
      apiFetchWithToken<UserOptionDto[]>('/admin/users/options', accessToken).catch(() => []),
    ])
      .then(([cfg, opts]) => {
        setConfig(cfg);
        setUsers(opts);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load CRM config.')));
  }, [accessToken]);

  async function post(path: string, body: unknown) {
    if (!accessToken || !id) return;
    setError('');
    try {
      await apiFetchWithToken(`/admin/enquiries/${id}${path}`, accessToken, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Action failed.'));
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    await post('/messages', { type: noteType, content: note });
    setNote('');
  }

  async function onGenerateSummary() {
    if (!accessToken || !id || generatingSummary) return;
    setSummaryError('');
    setGeneratingSummary(true);
    try {
      const data = await generateEnquirySummary(id, accessToken);
      setEnquiry((current) => (current ? { ...current, aiSummary: data.summary } : current));
      await load();
    } catch (err) {
      setSummaryError(getAiActionMessage(err));
    } finally {
      setGeneratingSummary(false);
    }
  }

  if (!enquiry && !error) return <p className="text-muted">Loading…</p>;

  const statuses = config.filter((c) => c.kind === 'enquiryStatus');
  const priorities = config.filter((c) => c.kind === 'enquiryPriority');

  return (
    <div className="space-y-6">
      <Link href="/admin/enquiries" className="text-sm text-muted hover:text-foreground">
        ← Inbox
      </Link>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {enquiry && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-mono text-2xl font-semibold">{enquiry.enquiryNumber}</h1>
              <p className="mt-1 text-sm">
                {enquiry.company} · {enquiry.contactName} · {enquiry.phone}
              </p>
              <p className="text-sm text-muted">
                Location: {getCountry(enquiry.country)?.flag} {getCountry(enquiry.country)?.name ?? enquiry.country}
                {' · '}
                Phone: {getCountry(enquiry.phoneCountry)?.flag}{' '}
                {getCountry(enquiry.phoneCountry)?.name ?? enquiry.phoneCountry} +
                {enquiry.phoneDialCode}
              </p>
              {enquiry.needsReview && (
                <p className="mt-1 text-sm text-amber-700">Needs review</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 rounded-lg border border-border px-3 text-sm"
                value={enquiry.statusId}
                onChange={(e) => post('/status', { statusId: e.target.value })}
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-lg border border-border px-3 text-sm"
                value={enquiry.priorityId}
                onChange={(e) => post('/priority', { priorityId: e.target.value })}
              >
                {priorities.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-lg border border-border px-3 text-sm"
                value={enquiry.assignedUserId ?? ''}
                onChange={(e) =>
                  post('/assign', { userId: e.target.value ? e.target.value : null })
                }
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <EnquiryLeadScoreCard enquiry={enquiry} />
            <EnquiryAiSummaryCard
              summary={enquiry.aiSummary}
              canGenerate={userHasPermission(user, 'enquiries.generate_ai')}
              generating={generatingSummary}
              error={summaryError}
              onGenerate={() => {
                void onGenerateSummary();
              }}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <h2 className="font-medium">Timeline</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {enquiry.timeline.map((item) => (
                  <div key={item.item.id} className="border-l-2 border-border pl-3 text-sm">
                    {item.kind === 'message' ? (
                      <>
                        <p className="font-medium">
                          {item.item.type} · {item.item.authorName}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{item.item.content}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">{item.item.eventType}</p>
                        <p className="text-muted">{JSON.stringify(item.item.data)}</p>
                      </>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {new Date(item.item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
                <form onSubmit={sendMessage} className="space-y-2 pt-4">
                  <select
                    className="h-10 rounded-lg border border-border px-3 text-sm"
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as 'agent' | 'internal_note')}
                  >
                    <option value="agent">Reply</option>
                    <option value="internal_note">Internal note</option>
                  </select>
                  <textarea
                    className="min-h-24 w-full rounded-lg border border-border px-3 py-2 text-sm"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    required
                  />
                  <Button type="submit">Add to timeline</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-medium">Details</h2>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted">Source:</span> {enquiry.source}
                </p>
                <form
                  className="space-y-3 border-t border-border pt-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!accessToken || !id) return;
                    setError('');
                    try {
                      await apiFetchWithToken(`/admin/enquiries/${id}`, accessToken, {
                        method: 'PATCH',
                        body: JSON.stringify(contactForm),
                      });
                      await load();
                    } catch (err) {
                      setError(getErrorMessage(err, 'Could not update contact details.'));
                    }
                  }}
                >
                  <CountrySelect
                    label="Business / location country"
                    value={contactForm.country}
                    onChange={(country) => setContactForm({ ...contactForm, country })}
                    required
                  />
                  <PhoneFields
                    phoneCountry={contactForm.phoneCountry}
                    nationalNumber={contactForm.phone}
                    onPhoneCountryChange={(phoneCountry) =>
                      setContactForm({ ...contactForm, phoneCountry })
                    }
                    onNationalNumberChange={(phone) => setContactForm({ ...contactForm, phone })}
                    required
                  />
                  <Button type="submit">Save contact details</Button>
                </form>
                <p>
                  <span className="text-muted">Requirement:</span>{' '}
                  {enquiry.requirementText || '—'}
                </p>
                <p className="whitespace-pre-wrap">{enquiry.message}</p>
                {enquiry.customer && (
                  <Link href={`/admin/customers/${enquiry.customer.id}`} className="underline">
                    Customer {enquiry.customer.customerNumber}
                  </Link>
                )}
                <label className="block pt-2 text-sm">
                  Next follow-up
                  <input
                    type="datetime-local"
                    className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
                    defaultValue={
                      enquiry.nextFollowUpAt
                        ? enquiry.nextFollowUpAt.slice(0, 16)
                        : ''
                    }
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (!value) return;
                      post('/follow-up', { nextFollowUpAt: new Date(value).toISOString() });
                    }}
                  />
                </label>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
