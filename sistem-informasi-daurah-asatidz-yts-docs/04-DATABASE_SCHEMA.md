# Database Schema

## 1. Konvensi

- Primary key: UUID.
- Timestamp: `timestamptz`.
- Semua timestamp disimpan dalam UTC.
- Tampilan mengikuti timezone event.
- Nama tabel: `snake_case`, plural.
- Nama foreign key: `<entity>_id`.
- Soft delete hanya untuk master data tertentu.
- Enum dapat berupa PostgreSQL enum atau check constraint sesuai keputusan tim.
- Kolom JSON hanya untuk metadata non-kritis, bukan relasi inti.

## 2. Entitas Inti

### `users`

```text
id uuid pk
email citext unique not null
name text
status text not null
last_login_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
```

### `roles`

```text
id uuid pk
code text unique not null
name text not null
description text
```

### `user_role_assignments`

```text
id uuid pk
user_id uuid fk users
role_id uuid fk roles
event_id uuid nullable fk events
institution_id uuid nullable fk institutions
starts_at timestamptz
ends_at timestamptz
created_by uuid fk users
created_at timestamptz not null
```

Constraint:

- Role global tidak memiliki `event_id`.
- Role event harus memiliki `event_id`.
- Role perwakilan lembaga dapat memiliki `institution_id`.

### `institutions`

```text
id uuid pk
code text unique not null
name text not null
legal_name text
institution_type text
email citext
phone text
whatsapp text
address text
province_code text
city_code text
district text
postal_code text
website text
status text not null
verification_status text not null
notes text
created_at timestamptz not null
updated_at timestamptz not null
deleted_at timestamptz
```

### `institution_representatives`

```text
id uuid pk
institution_id uuid fk institutions
user_id uuid nullable fk users
name text not null
email citext not null
phone text
position text
is_primary boolean not null default false
verified_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
```

### `ustadz_profiles`

```text
id uuid pk
user_id uuid nullable unique fk users
full_name text not null
normalized_name text not null
title_prefix text
title_suffix text
email citext
phone text
whatsapp text
birth_place text
birth_date date
address text
city_code text
province_code text
education_summary text
expertise_summary text
profile_photo_object_key text
profile_status text not null
created_at timestamptz not null
updated_at timestamptz not null
deleted_at timestamptz
```

### `ustadz_institution_affiliations`

```text
id uuid pk
ustadz_id uuid fk ustadz_profiles
institution_id uuid fk institutions
position text
is_primary boolean not null default false
start_date date
end_date date
status text not null
verified_at timestamptz
verified_by uuid nullable fk users
created_at timestamptz not null
updated_at timestamptz not null
```

Constraint:

- Satu afiliasi aktif yang identik tidak boleh ganda.
- Maksimal satu `is_primary=true` aktif per ustadz.

### `events`

```text
id uuid pk
code text unique not null
slug text unique not null
name text not null
subtitle text
description text
audience_mode text not null
attendance_mode text not null
timezone text not null default 'Asia/Jakarta'
start_date date not null
end_date date not null
venue_name text
venue_address text
maps_url text
registration_open_at timestamptz
registration_close_at timestamptz
default_institution_quota integer
capacity integer
status text not null
created_by uuid fk users
created_at timestamptz not null
updated_at timestamptz not null
archived_at timestamptz
```

Constraint:

- `end_date >= start_date`
- `capacity > 0` bila tidak null.
- `registration_close_at > registration_open_at` bila keduanya terisi.

### `event_days`

```text
id uuid pk
event_id uuid fk events
day_number integer not null
date date not null
title text
checkin_open_at timestamptz
checkin_close_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
```

Unique:

```text
(event_id, day_number)
(event_id, date)
```

### `event_sessions`

```text
id uuid pk
event_day_id uuid fk event_days
title text not null
session_type text not null
speaker_ustadz_id uuid nullable fk ustadz_profiles
moderator_name text
start_at timestamptz not null
end_at timestamptz not null
room text
attendance_required boolean not null default true
checkin_required boolean not null default true
checkin_open_at timestamptz
checkin_close_at timestamptz
sort_order integer not null
created_at timestamptz not null
updated_at timestamptz not null
```

Constraint:

- `end_at > start_at`.

### `event_committee_assignments`

```text
id uuid pk
event_id uuid fk events
user_id uuid fk users
committee_role text not null
permissions jsonb
starts_at timestamptz
ends_at timestamptz
created_by uuid fk users
created_at timestamptz not null
```

### `invitations`

```text
id uuid pk
event_id uuid fk events
invitation_type text not null
institution_id uuid nullable fk institutions
ustadz_id uuid nullable fk ustadz_profiles
invitation_number text not null
quota integer
status text not null
response_deadline timestamptz
scheduled_at timestamptz
sent_at timestamptz
responded_at timestamptz
created_by uuid fk users
created_at timestamptz not null
updated_at timestamptz not null
```

Check:

- `INSTITUTION` wajib memiliki `institution_id`.
- `INDIVIDUAL` wajib memiliki `ustadz_id`.

Unique:

```text
(event_id, invitation_number)
```

### `invitation_links`

```text
id uuid pk
invitation_id uuid fk invitations
token_hash text unique not null
expires_at timestamptz
max_uses integer
used_count integer not null default 0
revoked_at timestamptz
last_accessed_at timestamptz
created_at timestamptz not null
```

### `invitation_responses`

```text
id uuid pk
invitation_id uuid fk invitations
response_status text not null
representative_id uuid nullable fk institution_representatives
notes text
is_final boolean not null default false
submitted_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
```

### `event_participants`

```text
id uuid pk
event_id uuid fk events
ustadz_id uuid fk ustadz_profiles
institution_id uuid nullable fk institutions
invitation_id uuid nullable fk invitations
registration_source text not null
participant_code text not null
is_delegation_lead boolean not null default false
confirmation_status text not null
approval_status text not null
confirmed_at timestamptz
approved_at timestamptz
approved_by uuid nullable fk users
cancelled_at timestamptz
replacement_for_participant_id uuid nullable fk event_participants
notes text
created_at timestamptz not null
updated_at timestamptz not null
```

Unique:

```text
(event_id, ustadz_id)
(event_id, participant_code)
```

### `participant_status_histories`

```text
id uuid pk
participant_id uuid fk event_participants
status_type text not null
from_status text
to_status text not null
reason text
changed_by uuid nullable fk users
changed_at timestamptz not null
```

### `event_announcements`

```text
id uuid pk
event_id uuid fk events
title text not null
body text not null
audience_type text not null
status text not null
published_at timestamptz
created_by uuid fk users
created_at timestamptz not null
updated_at timestamptz not null
```

### `announcement_recipients`

```text
id uuid pk
announcement_id uuid fk event_announcements
user_id uuid nullable fk users
participant_id uuid nullable fk event_participants
institution_id uuid nullable fk institutions
read_at timestamptz
created_at timestamptz not null
```

### `attendance_records`

```text
id uuid pk
event_id uuid fk events
event_day_id uuid nullable fk event_days
event_session_id uuid nullable fk event_sessions
participant_id uuid fk event_participants
attendance_status text not null
checkin_at timestamptz
checkout_at timestamptz
checkin_method text
recorded_by uuid nullable fk users
source_device text
notes text
corrected_at timestamptz
corrected_by uuid nullable fk users
created_at timestamptz not null
updated_at timestamptz not null
```

Unique parsial/logis:

```text
participant_id + event_day_id untuk absensi harian
participant_id + event_session_id untuk absensi sesi
```

### `checkin_tokens`

```text
id uuid pk
event_id uuid fk events
event_day_id uuid nullable fk event_days
event_session_id uuid nullable fk event_sessions
token_hash text unique not null
valid_from timestamptz not null
valid_until timestamptz not null
max_uses integer
revoked_at timestamptz
created_by uuid fk users
created_at timestamptz not null
```

### `checkin_logs`

```text
id uuid pk
event_id uuid fk events
participant_id uuid nullable fk event_participants
event_session_id uuid nullable fk event_sessions
method text not null
result text not null
failure_reason text
scanned_by uuid nullable fk users
request_id text
metadata jsonb
created_at timestamptz not null
```

### `email_templates`

```text
id uuid pk
code text unique not null
name text not null
subject_template text not null
body_template text not null
status text not null
version integer not null
created_at timestamptz not null
updated_at timestamptz not null
```

### `email_jobs`

```text
id uuid pk
event_id uuid nullable fk events
template_id uuid fk email_templates
recipient_email citext not null
recipient_name text
payload jsonb not null
status text not null
scheduled_at timestamptz not null
locked_at timestamptz
locked_by text
attempt_count integer not null default 0
max_attempts integer not null default 5
idempotency_key text unique not null
last_error text
created_at timestamptz not null
updated_at timestamptz not null
```

### `email_deliveries`

```text
id uuid pk
email_job_id uuid fk email_jobs
provider text not null
provider_message_id text
status text not null
sent_at timestamptz
delivered_at timestamptz
opened_at timestamptz
bounced_at timestamptz
complained_at timestamptz
provider_payload jsonb
created_at timestamptz not null
updated_at timestamptz not null
```

### `audit_logs`

```text
id uuid pk
actor_user_id uuid nullable fk users
action text not null
resource_type text not null
resource_id uuid
event_id uuid nullable fk events
before_data jsonb
after_data jsonb
reason text
ip_hash text
user_agent text
request_id text
created_at timestamptz not null
```

## 3. Indeks Minimum

```text
ustadz_profiles(normalized_name)
ustadz_profiles(email)
ustadz_profiles(phone)
institutions(name)
events(status, start_date)
invitations(event_id, status)
event_participants(event_id, approval_status)
event_participants(event_id, institution_id)
attendance_records(event_id, participant_id)
attendance_records(event_session_id, attendance_status)
email_jobs(status, scheduled_at)
email_deliveries(provider_message_id)
audit_logs(event_id, created_at)
checkin_logs(event_id, created_at)
```

## 4. Merge Profil Ustadz

Merge dilakukan dalam transaksi:

1. Memilih profil survivor.
2. Memindahkan afiliasi.
3. Memindahkan participant history.
4. Memindahkan relasi undangan.
5. Menghindari duplicate constraint.
6. Menandai profil lama sebagai merged.
7. Menyimpan mapping `merged_into_id`.
8. Membuat audit log lengkap.

Tidak boleh melakukan hard delete langsung.

## 5. Data Derived

Jangan menyimpan jika dapat dihitung murah:

- Jumlah peserta lembaga.
- Persentase kehadiran.
- Jumlah respons.
- Kehadiran lengkap.
- Sisa kuota.

Gunakan view/materialized view hanya jika query agregasi mulai berat.
