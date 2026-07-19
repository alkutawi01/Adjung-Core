import React from 'react';
import { User } from '../../types';
import { useAppContext } from '../../context/AppContext';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accountEmail: string;
  setAccountEmail: (val: string) => void;
  accountUsername: string;
  setAccountUsername: (val: string) => void;
  accountPassword: string;
  setAccountPassword: (val: string) => void;
  accountConfirmPassword: string;
  setAccountConfirmPassword: (val: string) => void;
  accountError: string;
  handleSaveAccountSettings: (e: React.FormEvent) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  accountEmail,
  setAccountEmail,
  accountUsername,
  setAccountUsername,
  accountPassword,
  setAccountPassword,
  accountConfirmPassword,
  setAccountConfirmPassword,
  accountError,
  handleSaveAccountSettings,
}) => {
  const { showToast } = useAppContext();
  const [showVerification, setShowVerification] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState('');
  const [generatedCode, setGeneratedCode] = React.useState('');
  const [localError, setLocalError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      setShowVerification(false);
      setVerificationCode('');
      setGeneratedCode('');
      setLocalError('');
    }
  }, [isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleClose = () => {
    setShowVerification(false);
    setVerificationCode('');
    setGeneratedCode('');
    setLocalError('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    const emailChanged = accountEmail.trim().toLowerCase() !== (currentUser.email || '').trim().toLowerCase();

    if (emailChanged && !showVerification) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);
      setShowVerification(true);
      showToast(`Verification code sent to ${accountEmail.trim()}: ${code}`, 'info');
      return;
    }

    if (emailChanged && showVerification) {
      if (verificationCode !== generatedCode) {
        setLocalError('Invalid verification code. Please check your notifications.');
        return;
      }
    }

    handleSaveAccountSettings(e);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/65 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#FDFDFD] border border-adjung-maroon/25 rounded shadow-2xl max-w-md w-full overflow-hidden scholarly-border animate-fade-in text-left">
        
        {/* Modal header */}
        <div className="border-b border-stone-200 p-5 bg-[#FDFDFD] text-center">
          <h3 className="font-serif text-2xl text-adjung-maroon">Account Settings</h3>
          <p className="font-mono text-[9px] uppercase tracking-wider text-stone-500 mt-1">Platform Identity & Credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans text-stone-800">
          
          {(accountError || localError) && (
            <div className="p-2.5 bg-red-50 border border-red-100 text-red-800 rounded font-sans text-xs">
              {accountError || localError}
            </div>
          )}

          {/* Username Input */}
          <div>
            <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1 font-semibold">
              Subdomain / Domain
            </label>
            <div>
              <input
                type="text"
                value={accountUsername}
                className="w-full border border-stone-200 px-3 py-2.5 rounded bg-stone-50 text-stone-400 font-mono text-xs cursor-not-allowed select-none"
                disabled
                required
              />
            </div>
            <span className="text-[8px] font-mono text-stone-400 mt-1 block leading-normal">
              Your unique subdomain (e.g. {accountUsername}.adjung.com). Cannot be changed after registration.
            </span>
          </div>

          {/* Email Input */}
          <div>
            <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1 font-semibold">
              Username (Email)
            </label>
            <input
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              className="w-full border border-stone-200 p-2.5 rounded focus:outline-none focus:border-adjung-maroon font-mono text-xs"
              placeholder="e.g. scholar@adjung.com"
              disabled={showVerification}
            />
            <span className="text-[8px] font-mono text-stone-400 mt-1 block leading-normal">
              Used for password retrieval, platform communications, and board logs.
            </span>
          </div>

          {/* Verification Code Input */}
          {showVerification && (
            <div className="bg-stone-50 border border-stone-200 p-4 rounded space-y-2 animate-fade-in">
              <span className="block font-mono uppercase text-[9px] text-adjung-maroon tracking-wider font-semibold">
                Email Verification Code Required
              </span>
              <p className="text-[10px] text-stone-600 leading-normal font-serif">
                We have sent a 6-digit confirmation code to your new email <strong>{accountEmail}</strong>. Please enter the code below to authorize the change.
              </p>
              <input
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-stone-200 p-2.5 rounded focus:outline-none focus:border-adjung-maroon font-mono text-center tracking-[0.25em] text-base"
                placeholder="000000"
                required
              />
            </div>
          )}

          {/* Password Fields */}
          <div className="border-t border-stone-100 pt-3.5 space-y-3">
            <span className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider font-semibold">
              Update Password <span className="text-[8px] font-normal text-stone-400">(Leave blank to keep current)</span>
            </span>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono uppercase text-[8px] text-stone-400 tracking-wider mb-1">New Password</label>
                <input
                  type="password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-adjung-maroon font-mono text-xs"
                  placeholder="Min 4 characters"
                  disabled={showVerification}
                />
              </div>
              <div>
                <label className="block font-mono uppercase text-[8px] text-stone-400 tracking-wider mb-1">Confirm New</label>
                <input
                  type="password"
                  value={accountConfirmPassword}
                  onChange={(e) => setAccountConfirmPassword(e.target.value)}
                  className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-adjung-maroon font-mono text-xs"
                  placeholder="Repeat password"
                  disabled={showVerification}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-1/3 border border-stone-200 hover:bg-stone-50 text-stone-600 py-2.5 rounded text-xs font-mono uppercase tracking-wider transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-2/3 bg-[#802334] hover:opacity-95 text-[#FDFDFD] py-2.5 rounded text-xs font-mono uppercase tracking-wider transition shadow-sm font-semibold cursor-pointer"
            >
              {showVerification ? 'Confirm Email Change' : 'Save Credentials'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
export default AccountModal;
