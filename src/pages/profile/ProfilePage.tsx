import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdPerson,
  MdEdit,
  MdLock,
  MdSchool,
  MdBadge,
  MdFamilyRestroom,
  MdCheckCircle,
  MdErrorOutline,
  MdCamera,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../lib/auth-api';
import type { FullProfile } from '../../lib/auth-api';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { Badge } from '../../components/ui/Badge';
import { getRoleLabel } from '../../lib/role-labels';

// ── Avatar component ──────────────────────────────────────────────────────────

function Avatar({
  src,
  name,
  size = 'lg',
}: {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizeClass = { sm: 'h-10 w-10 text-base', md: 'h-14 w-14 text-xl', lg: 'h-20 w-20 text-2xl', xl: 'h-28 w-28 text-4xl' }[size];
  const initials = name
    ? name.split(' ').map((w) => w[0]?.toUpperCase()).slice(0, 2).join('')
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Profile picture'}
        className={`${sizeClass} rounded-full object-cover border-2 border-white shadow-sm`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-pine-700 font-bold text-white shadow-sm select-none`}>
      {initials}
    </div>
  );
}

// ── Role-specific info section ────────────────────────────────────────────────

function RoleSection({ profile }: { profile: FullProfile }) {
  const rd = profile.roleData as Record<string, unknown> | null;
  if (!rd) return null;

  switch (profile.role) {
    case 'TEACHER': {
      const assignments = (rd.assignments as { subjectName: string; className: string; section: string; academicYear: string }[] | null) ?? [];
      const homerooms = (rd.homeroomClasses as { className: string; section: string; academicYear: string }[] | null) ?? [];
      return (
        <div className="flex flex-col gap-4">
          {(rd.qualification || rd.specialization || rd.phoneNumber) && (
            <InfoCard title="Teacher Details">
              {rd.qualification && <Field label="Qualification" value={String(rd.qualification)} />}
              {rd.specialization && <Field label="Specialization" value={String(rd.specialization)} />}
              {rd.phoneNumber && <Field label="Phone" value={String(rd.phoneNumber)} />}
            </InfoCard>
          )}
          {assignments.length > 0 && (
            <InfoCard title="Teaching Assignments">
              {assignments.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
                  <span className="font-medium">{a.subjectName}</span>
                  <span className="text-slate-500">{a.className} {a.section} ({a.academicYear})</span>
                </div>
              ))}
            </InfoCard>
          )}
          {homerooms.length > 0 && (
            <InfoCard title="Homeroom Classes">
              {homerooms.map((c, i) => (
                <div key={i} className="text-sm py-1.5 border-b border-slate-100 last:border-0">
                  {c.className} {c.section} ({c.academicYear})
                </div>
              ))}
            </InfoCard>
          )}
        </div>
      );
    }

    case 'STUDENT': {
      const classroom = rd.classroom as { className: string; section: string; academicYear: string } | null;
      const parents = (rd.parents as { fullName: string; phoneNumber: string | null; relationship: string }[] | null) ?? [];
      return (
        <div className="flex flex-col gap-4">
          <InfoCard title="Student Information">
            {rd.admissionNumber && <Field label="Student ID" value={String(rd.admissionNumber)} mono />}
            {rd.gender && <Field label="Gender" value={rd.gender === 'M' ? 'Male' : 'Female'} />}
            {rd.dateOfBirth && <Field label="Date of Birth" value={String(rd.dateOfBirth)} />}
            {rd.address && <Field label="Address" value={String(rd.address)} />}
            {rd.admissionType && <Field label="Admission Type" value={rd.admissionType === 'NEW_STUDENT' ? 'New Student' : 'Transfer'} />}
            {rd.enrolledAt && <Field label="Enrolled" value={new Date(String(rd.enrolledAt)).toLocaleDateString()} />}
          </InfoCard>
          {classroom && (
            <InfoCard title="Current Enrollment">
              <Field label="Grade" value={`${classroom.className} — Section ${classroom.section}`} />
              <Field label="Academic Year" value={classroom.academicYear} />
            </InfoCard>
          )}
          {parents.length > 0 && (
            <InfoCard title="Guardians">
              {parents.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
                  <div>
                    <span className="font-medium">{p.fullName}</span>
                    {p.phoneNumber && <span className="ml-2 text-slate-500">{p.phoneNumber}</span>}
                  </div>
                  <Badge tone="neutral">{p.relationship}</Badge>
                </div>
              ))}
            </InfoCard>
          )}
        </div>
      );
    }

    case 'PARENT': {
      const children = (rd.children as {
        admissionNumber: string; firstName: string; lastName: string;
        relationship: string;
        classroom: { className: string; section: string; academicYear: string } | null;
      }[] | null) ?? [];
      return (
        <div className="flex flex-col gap-4">
          {rd.phoneNumber && (
            <InfoCard title="Contact">
              <Field label="Phone" value={String(rd.phoneNumber)} />
            </InfoCard>
          )}
          {children.length > 0 && (
            <InfoCard title="Linked Children">
              {children.map((c, i) => (
                <div key={i} className="py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{c.firstName} {c.lastName}</span>
                    <Badge tone="neutral">{c.relationship}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 font-mono">{c.admissionNumber}</div>
                  {c.classroom && (
                    <div className="text-xs text-slate-500">
                      {c.classroom.className} {c.classroom.section} ({c.classroom.academicYear})
                    </div>
                  )}
                </div>
              ))}
            </InfoCard>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

// ── Tiny reusable components ──────────────────────────────────────────────────

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="min-w-[140px] shrink-0 text-[0.8125rem] text-slate-500">{label}</span>
      <span className={`text-[0.875rem] text-ink-900 ${mono ? 'font-mono font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

// ── Change Password form ──────────────────────────────────────────────────────

function ChangePasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError('New passwords do not match.'); return; }
    if (next.length < 8)  { setError('New password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next, confirmNewPassword: confirm });
      setSuccess(true);
      setCurrent(''); setNext(''); setConfirm('');
      setTimeout(onSuccess, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-pine-200 bg-pine-50 px-4 py-3">
        <MdCheckCircle className="h-5 w-5 text-pine-700" />
        <p className="text-sm font-semibold text-pine-800">Password changed successfully.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-3">
      <TextField label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      <TextField label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      <TextField label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5">
          <MdErrorOutline className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
          <p className="text-sm text-danger-700">{error}</p>
        </div>
      )}
      <Button type="submit" isLoading={loading} className="self-start">Change Password</Button>
    </form>
  );
}

// ── Main ProfilePage ──────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab,    setActiveTab]    = useState<'profile' | 'password'>('profile');
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue,   setEmailValue]   = useState('');
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [saveSuccess,  setSaveSuccess]  = useState(false);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['auth', 'profile'],
    queryFn: () => authApi.getProfile(),
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: (input: { email?: string | null; profilePicture?: string | null }) =>
      authApi.updateProfile(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['auth', 'profile'] });
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      setSaveSuccess(true);
      setEditingEmail(false);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : 'Could not save changes.');
    },
  });

  // ── Profile picture ────────────────────────────────────────────────────────
  function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSaveError('Only JPG, PNG, or WebP images are supported.'); return;
    }
    if (file.size > 2_000_000) {
      setSaveError('Image must be smaller than 2 MB.'); return;
    }
    setSaveError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateMutation.mutate({ profilePicture: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePicture() {
    updateMutation.mutate({ profilePicture: null });
  }

  function handleSaveEmail() {
    setSaveError(null);
    updateMutation.mutate({ email: emailValue.trim() || null });
  }

  const rd = profile?.roleData as Record<string, unknown> | null;
  const fullName = (rd?.fullName as string | null) ?? user?.username ?? '';
  const statusTone = profile?.status === 'ACTIVE' ? 'positive' as const : profile?.status === 'LOCKED' ? 'danger' as const : 'neutral' as const;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-20 text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
        Loading profile…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-4">
        <p className="text-sm text-danger-700">
          {error instanceof Error ? error.message : 'Could not load profile.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl">My Profile</h1>
      <LedgerRule />

      {/* Temporary password warning */}
      {profile.isTemporaryPassword && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3">
          <MdLock className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
          <p className="text-sm text-gold-700">
            <strong>You are using a temporary password.</strong> Please change it now to secure your account.
          </p>
          <button type="button" onClick={() => setActiveTab('password')} className="ml-auto shrink-0 text-sm font-semibold text-gold-700 underline hover:no-underline">
            Change now
          </button>
        </div>
      )}

      {/* Profile header card */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          {/* Avatar with upload */}
          <div className="relative group">
            <Avatar src={profile.profilePicture} name={fullName} size="xl" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Change profile picture"
            >
              <MdCamera className="h-6 w-6 text-white" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePictureChange}
            />
          </div>

          {/* Basic info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold text-ink-900 truncate">{fullName || profile.username}</h2>
              <Badge tone={statusTone}>{profile.status}</Badge>
              {profile.isTemporaryPassword && <Badge tone="warning">Temporary Password</Badge>}
            </div>
            <p className="text-sm font-mono text-slate-500 mb-1">{profile.username}</p>
            <p className="text-sm text-slate-500">{getRoleLabel(profile.role as never)}</p>

            {/* Email row */}
            <div className="mt-3 flex items-center gap-2">
              {editingEmail ? (
                <>
                  <TextField
                    label=""
                    type="email"
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                    placeholder="email@example.com"
                    className="max-w-[260px]"
                  />
                  <Button onClick={handleSaveEmail} isLoading={updateMutation.isPending} className="text-xs py-1.5 px-3">Save</Button>
                  <Button variant="ghost" onClick={() => setEditingEmail(false)} className="text-xs py-1.5 px-3">Cancel</Button>
                </>
              ) : (
                <>
                  <span className="text-sm text-slate-600">{profile.email ?? <em className="text-slate-400">No email set</em>}</span>
                  <button
                    type="button"
                    onClick={() => { setEmailValue(profile.email ?? ''); setEditingEmail(true); }}
                    className="text-xs text-pine-700 hover:underline"
                  >
                    <MdEdit className="inline h-3.5 w-3.5" /> Edit
                  </button>
                </>
              )}
            </div>

            {profile.profilePicture && (
              <button type="button" onClick={handleRemovePicture} className="mt-2 text-xs text-danger-600 hover:underline">
                Remove profile picture
              </button>
            )}
          </div>
        </div>

        {(saveError || saveSuccess) && (
          <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${saveSuccess ? 'bg-pine-50 text-pine-700' : 'bg-danger-50 text-danger-700'}`}>
            {saveSuccess ? <MdCheckCircle className="h-4 w-4" /> : <MdErrorOutline className="h-4 w-4" />}
            {saveSuccess ? 'Changes saved.' : saveError}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {[
          { id: 'profile' as const, label: 'Profile',         icon: MdPerson },
          { id: 'password' as const, label: 'Change Password', icon: MdLock  },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === id ? 'border-pine-700 text-pine-800' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <div className="flex flex-col gap-4">
          {/* Account info */}
          <InfoCard title="Account Information">
            <Field label="Username" value={profile.username} mono />
            <Field label="Role" value={getRoleLabel(profile.role as never)} />
            <Field label="Status" value={profile.status} />
            {profile.lastLoginAt && (
              <Field label="Last Login" value={new Date(profile.lastLoginAt).toLocaleString()} />
            )}
            <Field label="Member Since" value={new Date(profile.createdAt).toLocaleDateString()} />
          </InfoCard>

          {/* Role-specific content */}
          <RoleSection profile={profile} />
        </div>
      )}

      {/* Change password tab */}
      {activeTab === 'password' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">Change Password</p>
          <ChangePasswordForm onSuccess={() => setActiveTab('profile')} />
        </div>
      )}
    </div>
  );
}
