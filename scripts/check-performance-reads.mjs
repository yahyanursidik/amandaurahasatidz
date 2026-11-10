/** Live read-only regression. Explicit URL/host only; never loads or edits .env. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { neon } from '@neondatabase/serverless';

const connection = process.env.PERFORMANCE_DATABASE_URL;
const expectedHost = process.argv.find(value => value.startsWith('--expected-host='))?.slice('--expected-host='.length);
if (!connection || !expectedHost) throw new Error('PERFORMANCE_DATABASE_URL dan --expected-host=<host> wajib diisi eksplisit.');
const target = new URL(connection);
assert.equal(target.hostname, expectedHost, 'Database host must match the explicitly approved test host');
const output = process.argv.find(value => value.startsWith('--output='))?.slice('--output='.length)
  || path.join(process.env.LOCALAPPDATA || process.env.TEMP, 'Temp', 'opencode', 'performance-read-results.json');
const root = path.resolve(import.meta.dirname, '..');
const sql = neon(connection);
const readonly = async (query, params = []) => {
  assert.match(query.trim(), /^(?:select\b|explain\s*\()/i, 'Only SELECT and read-only EXPLAIN are permitted');
  return (await sql.transaction([sql(query, params)], { readOnly: true }))[0];
};
globalThis.__performanceReadQueries = [];
globalThis.__performanceReadConnection = connection;
const server = await createServer({ root, configFile: false, envDir: false,
  cacheDir: path.join(path.dirname(output), 'performance-read-vite-cache'),
  optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true },
  resolve: { alias: { '@': path.join(root, 'src') } },
  plugins: [{ name: 'readonly-performance-driver', enforce: 'pre', load(id) {
    if (!id.replaceAll('\\', '/').endsWith('/netlify/functions/lib/db/client.ts')) return;
    return `import {neon} from '@neondatabase/serverless'; import {drizzle} from 'drizzle-orm/neon-http'; import * as schema from './schema';
      export function getDbClient(){const raw=neon(globalThis.__performanceReadConnection); return drizzle(async(query,params,options={})=>{
        if(!/^select\\b/i.test(query.trim()))throw new Error('Write query blocked by read-only regression driver');
        const start=performance.now();const [result]=await raw.transaction([raw(query,params)],{...options,readOnly:true});
        globalThis.__performanceReadQueries.push({sql:query,params,ms:Math.round(performance.now()-start),rows:result.rows?.length??result.length,bytes:Buffer.byteLength(JSON.stringify(result))});return result;
      },{schema});}`;
  } }],
});
const results = [];
const measure = async (label, action) => {
  globalThis.__performanceReadQueries.length = 0;
  const start = performance.now(), data = await action();
  const queries = [...globalThis.__performanceReadQueries];
  const measurement = { label, totalMs: Math.round(performance.now() - start), queryCount: queries.length,
    fetchedRows: queries.reduce((sum, item) => sum + item.rows, 0), rawDbJsonBytes: queries.reduce((sum, item) => sum + item.bytes, 0),
    responseJsonBytes: Buffer.byteLength(JSON.stringify(data)), visibleRows: Array.isArray(data) ? data.length : data?.data?.length ?? null };
  results.push(measurement);
  return { data, queries };
};
try {
  const [participants, directory, events, dashboard, validation, communication] = await Promise.all([
    server.ssrLoadModule('/netlify/functions/lib/repositories/participantRepository.ts'),
    server.ssrLoadModule('/netlify/functions/lib/repositories/ustadzRepository.ts'),
    server.ssrLoadModule('/netlify/functions/lib/repositories/eventRepository.ts'),
    server.ssrLoadModule('/netlify/functions/lib/services/dashboardService.ts'),
    server.ssrLoadModule('/netlify/functions/lib/validations/participantValidation.ts'),
    server.ssrLoadModule('/src/lib/participantCommunication.ts'),
  ]);
  const [historical] = await readonly('select event_id as id, count(*)::int as total from event_participants group by event_id order by count(*) desc limit 1');
  assert.ok(historical?.total > 25, 'Representative event with more than one page is required');
  const eventId = historical.id;
  const all = (await measure('participants_complete_legacy', () => participants.findParticipantsRepository(eventId))).data;
  assert.equal(all.length, historical.total);
  const pageQuery = input => validation.participantPageQuerySchema.parse(input);
  const first = await measure('participants_page_25', () => participants.findParticipantPageRepository(eventId, pageQuery({})));
  assert.equal(first.data.data.length, 25); assert.equal(first.data.meta.total, all.length);
  assert.deepEqual(first.data.data.map(person => person.id), all.slice(0, 25).map(person => person.id));
  const pagedIds = [];
  for (let page = 1; page <= first.data.meta.pageCount; page++) {
    const response = await participants.findParticipantPageRepository(eventId, pageQuery({ page }));
    pagedIds.push(...response.data.map(person => person.id));
  }
  assert.deepEqual(pagedIds, all.map(person => person.id), 'All historical participants remain accessible with no duplicates/gaps');
  const eligible = person => ['PENDING_REVIEW', 'WAITLISTED'].includes(person.approvalStatus) && ['INVITED', 'CONFIRMED'].includes(person.confirmationStatus);
  const contact = person => ({ whatsapp: person.ustadzWhatsapp, phone: person.ustadzPhone, email: person.ustadzEmail, address: person.ustadzAddress });
  const complete = person => communication.getMissingParticipantContactFields(contact(person)).length === 0;
  const summary = first.data.meta.summary;
  assert.equal(summary.approved, all.filter(person => person.approvalStatus === 'APPROVED').length);
  assert.equal(summary.pendingEligible, all.filter(person => person.approvalStatus === 'PENDING_REVIEW' && eligible(person)).length);
  assert.equal(summary.completeContacts, all.filter(complete).length);
  assert.equal(summary.portalReady, all.filter(person => person.portalPasswordConfigured).length);
  const contactCases = { COMPLETE: complete, INCOMPLETE: person => !complete(person),
    NO_WHATSAPP: person => !(person.ustadzWhatsapp || person.ustadzPhone), NO_PORTAL: person => !person.portalPasswordConfigured };
  for (const [filter, match] of Object.entries(contactCases)) {
    const response = await participants.findParticipantPageRepository(eventId, pageQuery({ contact: filter }));
    assert.equal(response.meta.total, all.filter(match).length, `Contact filter ${filter} matches the existing JS rule`);
  }
  for (const status of ['PENDING_REVIEW', 'APPROVED', 'WAITLISTED', 'DECLINED', 'CANCELLED', 'NEEDS_ACTION']) {
    const match = person => status === 'DECLINED' ? ['DECLINED', 'REJECTED'].includes(person.approvalStatus)
      : status === 'CANCELLED' ? person.confirmationStatus === 'CANCELLED'
        : status === 'NEEDS_ACTION' ? person.approvalStatus === 'PENDING_REVIEW' || !complete(person) || !person.portalPasswordConfigured : person.approvalStatus === status;
    assert.equal((await participants.findParticipantPageRepository(eventId, pageQuery({ status }))).meta.total, all.filter(match).length, `Status filter ${status}`);
  }
  const selection = await measure('participants_selection_100', () => participants.findParticipantPageRepository(eventId, pageQuery({ pageSize: 100, projection: 'selection', eligible: 'true' })));
  assert.equal(selection.data.meta.total, all.filter(eligible).length);
  assert.ok(selection.data.data.every(person => !('ustadzEmail' in person) && !('statusReason' in person) && eligible(person)));
  const lastPage = await participants.findParticipantPageRepository(eventId, pageQuery({ page: first.data.meta.pageCount + 1 }));
  assert.deepEqual(lastPage.data, []); assert.equal(lastPage.meta.pageCount, first.data.meta.pageCount);
  const profiles = await readonly('select id, normalized_name as "normalizedName", email, phone, whatsapp, address, city_code as "cityCode", province_code as "provinceCode", education_summary as "educationSummary", expertise_summary as "expertiseSummary", profile_status as "profileStatus", deleted_at as "deletedAt" from ustadz_profiles');
  const active = profiles.filter(person => !person.deletedAt);
  const duplicates = person => active.some(other => other.id !== person.id && other.profileStatus === 'ACTIVE'
    && ['normalizedName', 'email', 'phone'].some(key => person[key] && person[key] === other[key]));
  const list = await measure('ustadz_directory_page_25', () => directory.findUstadzProfilesRepository({ page: 1, pageSize: 25 }));
  assert.equal(list.data.meta.summary.total, active.length);
  assert.equal(list.data.meta.summary.incomplete, active.filter(person => directory.getUstadzCompletenessPercent(person) < 70).length);
  assert.equal(list.data.meta.summary.duplicateCandidates, active.filter(person => person.profileStatus === 'ACTIVE' && duplicates(person)).length);
  assert.equal(list.data.meta.summary.archived, profiles.length - active.length);
  for (const query of [{ duplicate: 'true' }, { quality: 'incomplete' }, { duplicate: 'true', quality: 'incomplete' }]) {
    const result = await directory.findUstadzProfilesRepository({ page: 1, pageSize: 25, ...query });
    assert.equal(result.meta.total, active.filter(person => (!query.duplicate || duplicates(person)) && (!query.quality || directory.getUstadzCompletenessPercent(person) < 70)).length);
  }
  const [history] = await readonly('select ustadz_id as id from event_participants group by ustadz_id order by count(*) desc limit 1');
  const detail = (await measure('ustadz_profile_complete_history', () => directory.findUstadzByIdRepository(history.id))).data;
  const [historyCount] = await readonly('select count(*)::int as total from event_participants where ustadz_id=$1::uuid', [history.id]);
  assert.equal(detail.eventHistory.length, historyCount.total);
  await measure('event_detail_complete', () => events.findEventByIdRepository(eventId));
  await measure('event_registration_settings', () => events.findRegistrationEventRepository(eventId));
  const options = await measure('event_picker_options', () => events.findEventOptionsRepository());
  assert.ok(options.data.every(event => !('posterUrl' in event) && !('description' in event)));
  const admin = await measure('admin_dashboard_single_query', () => dashboard.getAdminDashboardMetricsService());
  const [adminExpected] = await readonly(`select
    (select count(*)::int from events where status in ('PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','ONGOING')) as "activeEventsCount",
    (select count(*)::int from institutions where deleted_at is null) as "invitedInstitutionsCount",
    (select count(*)::int from ustadz_profiles where deleted_at is null) as "asatidzProfilesCount",
    (select count(*)::int from ustadz_profiles where deleted_at is not null) as "archivedProfilesCount",
    (select count(*)::int from events where status='REGISTRATION_OPEN') as "openRegistrationsCount",
    (select count(*)::int from event_participants where approval_status='APPROVED') as "approvedParticipantsCount",
    (select count(*)::int from event_participants where approval_status='PENDING_REVIEW') as "pendingParticipantsCount"`);
  for (const [key, value] of Object.entries(adminExpected)) assert.equal(admin.data[key], value, `Dashboard metric ${key}`);
  const committee = await measure('committee_dashboard_single_query', () => dashboard.getCommitteeDashboardMetricsService(eventId));
  assert.equal(committee.data.totalParticipantsCount, all.length);
  const catalog = await measure('public_featured_3', () => events.findPublicProgramPageRepository({ page: 1, pageSize: 3, search: '', view: 'featured' }));
  assert.ok(catalog.data.data.length <= 3 && catalog.data.data.every(item => !item.posterUrl?.startsWith('data:')));
  const historyPage = await measure('public_history_12', () => events.findPublicProgramPageRepository({ page: 1, pageSize: 12, search: '', view: 'history' }));
  assert.ok(historyPage.data.data.every(item => item.status === 'COMPLETED'));
  const indexes = await readonly("select c.relname as name, i.indisvalid as valid, i.indisready as ready from pg_index i join pg_class c on c.oid=i.indexrelid where c.relname in ('idx_participants_ustadz','idx_participants_event_created','idx_participant_history_latest','idx_ustadz_norm_name','idx_ustadz_phone') order by c.relname");
  assert.ok(indexes.every(index => index.valid && index.ready), 'Any existing optional performance indexes must be valid/ready');
  const plans = [];
  // Parallel reads can finish in either order; identify SQL by shape, not arrival order.
  for (const [name, query] of [['participant_page', first.queries.find(item => item.sql.includes('participant_status_histories'))],
    ['directory_summary', list.queries.find(item => item.sql.includes('duplicate_profile') && item.sql.includes('count(*) filter'))]]) {
    assert.ok(query, `${name} SQL captured`);
    const [row] = await readonly(`explain (analyze, buffers, format json) ${query.sql}`, query.params);
    const explain = row['QUERY PLAN'][0];
    const nodes = []; const visit = plan => { nodes.push({ node: plan['Node Type'], index: plan['Index Name'] || null, rows: plan['Actual Rows'] }); for (const child of plan.Plans || []) visit(child); };
    visit(explain.Plan); plans.push({ name, executionMs: explain['Execution Time'], planningMs: explain['Planning Time'], nodes });
  }
  const report = { result: 'PASS', date: new Date().toISOString(), host: expectedHost,
    note: 'READ ONLY transactions on explicit test host. Timings are local repository samples, not deployed API latency or a load test. No personal rows or credentials retained.',
    historicalParticipants: all.length, historyEvents: detail.eventHistory.length, indexes, results, plans };
  await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await server.close(); delete globalThis.__performanceReadConnection; delete globalThis.__performanceReadQueries;
}
