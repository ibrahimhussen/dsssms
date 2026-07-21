import { Link } from 'react-router-dom';
import { LedgerRule } from '../../components/ui/LedgerRule';

export function NotFoundPage() {
  return (
    <div className="page status-page">
      <h1 className="page-title">Page not found</h1>
      <LedgerRule />
      <p className="page-lead">The page you're looking for doesn't exist or may have moved.</p>
      <Link to="/" className="btn btn-secondary">
        <span className="btn-label">Back to dashboard</span>
      </Link>
    </div>
  );
}
