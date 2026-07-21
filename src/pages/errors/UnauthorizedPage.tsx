import { Link } from 'react-router-dom';
import { LedgerRule } from '../../components/ui/LedgerRule';

export function UnauthorizedPage() {
  return (
    <div className="page status-page">
      <h1 className="page-title">You don't have access to this page</h1>
      <LedgerRule />
      <p className="page-lead">Your account role doesn't permit this section. If this seems wrong, contact your administrator.</p>
      <Link to="/" className="btn btn-secondary">
        <span className="btn-label">Back to dashboard</span>
      </Link>
    </div>
  );
}
