import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../lib/role-labels';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LedgerRule } from '../../components/ui/LedgerRule';

export function ProfilePage() {
  const { user } = useAuth();

  const [username] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <div className="mb-2">
        <h1 className="text-2xl">My Profile</h1>
        <p className="text-sm text-slate-500">View and update your personal user profile details</p>
      </div>
      <LedgerRule />

      <Card>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pine-100 text-2xl font-bold text-pine-700">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink-900">{user.username}</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="positive">{getRoleLabel(user.role)}</Badge>
              <span className="text-xs text-slate-400">Account ID: #{user.userId}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <TextField label="Username" value={username} disabled />

          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
          />

          <TextField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter contact phone number"
          />

          {savedSuccess && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              Profile updated successfully!
            </p>
          )}

          <div className="pt-2 flex justify-end">
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
