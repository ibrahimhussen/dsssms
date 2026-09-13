import { useMyParentProfile } from '../../hooks/useParents';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { MdSchool, MdAssessment, MdDescription, MdFactCheck, MdMenuBook } from 'react-icons/md';
import { Link } from 'react-router-dom';

export function ParentChildrenPage() {
  const { data: profile, isLoading } = useMyParentProfile();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900">Academic Overview</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Select a child to view their academic records.
      </p>
      <LedgerRule />

      {isLoading && (
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {!isLoading && (!profile?.children || profile.children.length === 0) && (
        <EmptyState
          title="No children linked"
          description="Contact the school to link your children to your account."
        />
      )}

      {!isLoading && profile && profile.children.length > 0 && (
        <div className="flex flex-col gap-5">
          {profile.children.map((child) => (
            <div
              key={child.studentId}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              {/* Child header */}
              <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine-100">
                  <MdSchool className="h-5 w-5 text-pine-700" />
                </div>
                <div>
                  <p className="font-semibold text-ink-900">
                    {child.firstName} {child.lastName}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{child.admissionNumber}</p>
                </div>
                <span className="ml-auto rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-600 font-medium capitalize">
                  {child.relationship.toLowerCase().replace('_', ' ')}
                </span>
              </div>

              {/* Quick-links — each carries ?studentId= so the target page knows which child */}
              <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
                {[
                  { label: 'Assessment', to: `/parent/assessment?studentId=${child.studentId}`,  Icon: MdAssessment },
                  { label: 'Report Card', to: `/parent/report-card?studentId=${child.studentId}`, Icon: MdDescription },
                  { label: 'Results',    to: `/parent/results?studentId=${child.studentId}`,      Icon: MdDescription },
                  { label: 'Attendance', to: `/parent/attendance?studentId=${child.studentId}`,   Icon: MdFactCheck },
                  { label: 'Transcript', to: `/parent/transcript?studentId=${child.studentId}`,   Icon: MdMenuBook },
                ].map(({ label, to, Icon }) => (
                  <Link
                    key={label}
                    to={to}
                    className="flex flex-col items-center gap-1 px-4 py-3 text-sm font-medium text-pine-700 hover:bg-pine-50 transition-colors text-center"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
