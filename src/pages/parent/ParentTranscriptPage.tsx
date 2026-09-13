import { useSearchParams } from 'react-router-dom';
import { useMyParentProfile } from '../../hooks/useParents';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { SelectField } from '../../components/ui/SelectField';
import { EmptyState } from '../../components/ui/EmptyState';
import { TranscriptPage } from '../transcript/TranscriptPage';

export function ParentTranscriptPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useMyParentProfile();

  const selectedId = searchParams.get('studentId')
    ? Number(searchParams.get('studentId'))
    : profile?.children[0]?.studentId;

  if (profileLoading)
    return (
      <div className="flex items-center gap-2 py-16 text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
        <span className="text-sm">Loading…</span>
      </div>
    );

  if (!profile?.children.length)
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink-900">Transcript</h1>
        <LedgerRule />
        <EmptyState
          title="No children linked"
          description="Contact the school to link your children to your account."
        />
      </div>
    );

  return (
    <div className="max-w-full">
      {profile.children.length > 1 && (
        <div className="mb-4">
          <SelectField
            label="Child"
            className="min-w-[200px]"
            value={selectedId ?? ''}
            onChange={(e) => setSearchParams({ studentId: e.target.value })}
          >
            {profile.children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      <TranscriptPage overrideStudentId={selectedId} />
    </div>
  );
}
