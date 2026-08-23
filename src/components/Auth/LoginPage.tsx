import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, TreePine, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle, Clock, Link2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { AuthError, getInvitationAdminApi } from '../../lib/adapters';
import type { InvitationContextInfo } from '../../lib/adapters';
import { formatDate as formatDateWithLocale } from '../../lib/i18n';

interface LoginFormData {
  name: string;
  email: string;
  password: string;
}

interface LoginErrors {
  name?: string;
  email?: string;
  password?: string;
  general?: string;
}

/**
 * Honest registration and login feedback (P2-1, AC-5c):
 * a pending account never sees a fake success line. Register answers
 * either a working session or the amber waiting-for-activation panel,
 * and login against a pending or disabled account explains the state
 * instead of a bare "login failed".
 */
export const LoginPage: React.FC = () => {
  const { login, register, isLoading, error } = useAuthStore();
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState<LoginFormData>({
    name: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  // Email of a registration the server accepted as pending (202, no token).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // Blocked login reason mapped from the server error code.
  const [loginBlock, setLoginBlock] = useState<'pending' | 'disabled' | null>(null);

  // Invitation link context (P2-3 AC-6): /register?invite=<token> loads the
  // public info before submit so the registrant knows what they are joining.
  // The token is only sent on signup when the info loaded successfully; a
  // dead link (404/410) shows the honest server message and never travels.
  // Read once: the query param cannot change without a full page reload,
  // and a lazy initializer avoids a synchronous setState in the effect.
  const [inviteToken] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('invite'),
  );
  const [inviteInfo, setInviteInfo] = useState<InvitationContextInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    const api = getInvitationAdminApi();
    // Every state update happens in an async continuation, never directly
    // in the effect body. A missing adapter surfaces as the same honest
    // "info unavailable" message the dead-link path uses.
    const infoPromise: Promise<InvitationContextInfo> = api
      ? api.getInvitationInfo(inviteToken)
      : Promise.reject(new Error(t('invite.infoUnavailable')));
    infoPromise
      .then((info) => {
        if (!cancelled) setInviteInfo(info);
      })
      .catch((err) => {
        if (cancelled) return;
        setInviteInfo(null);
        // The server message is already the honest dead-link explanation
        // (expired, revoked, exhausted, or unknown token).
        const message = err instanceof Error && err.message !== '' ? err.message : t('invite.deadLink');
        setInviteError(message);
      });
    return () => {
      cancelled = true;
    };
    // Runs once per mount; the token is fixed for the page lifetime and t
    // is stable enough for a one-shot fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateForm = (): boolean => {
    const newErrors: LoginErrors = {};

    if (isSignUp && !formData.name.trim()) {
      newErrors.name = t('auth.nameRequired');
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('auth.emailInvalid');
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = t('auth.passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('auth.passwordMin');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setPendingEmail(null);
    setLoginBlock(null);
    if (isSignUp) {
      try {
        // A working session (first account: active owner) routes straight
        // into the app via the auth store. Everything else lands in catch.
        // The invitation token rides along only when its info loaded.
        await register(formData.email, formData.password, formData.name.trim(), inviteInfo ? inviteToken ?? undefined : undefined);
      } catch (err) {
        if (err instanceof AuthError && err.code === 'ACCOUNT_PENDING') {
          setPendingEmail(formData.email);
        }
        // Other failures already sit in the store error slot.
      }
    } else {
      try {
        await login(formData.email, formData.password);
      } catch (err) {
        if (err instanceof AuthError && err.code === 'ACCOUNT_PENDING') {
          setLoginBlock('pending');
        } else if (err instanceof AuthError && err.code === 'ACCOUNT_DISABLED') {
          setLoginBlock('disabled');
        }
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      setErrors({ email: t('auth.forgotRequired') });
      return;
    }

    // Simulate forgot password
    setSuccessMessage(t('auth.forgotSuccess'));
    setShowForgotPassword(false);
    setFormData({ name: '', email: '', password: '' });
  };

  const updateFormData = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setErrors({});
    setSuccessMessage('');
    setPendingEmail(null);
    setLoginBlock(null);
    setFormData({ name: '', email: '', password: '' });
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-pink-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <TreePine className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.forgotTitle')}</h1>
              <p className="text-gray-600">{t('auth.forgotSubtitle')}</p>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <p className="text-green-800 text-sm">{successMessage}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData('email', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder={t('auth.emailPlaceholder')}
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <span>{t('auth.forgotSubmit')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full text-gray-600 hover:text-gray-800 transition-colors"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <TreePine className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isSignUp ? t('auth.signupTitle') : t('auth.signinTitle')}
            </h1>
            <p className="text-gray-600">
              {isSignUp ? t('auth.signupSubtitle') : t('auth.signinSubtitle')}
            </p>
          </div>

          {/* Invitation context (P2-3): shown before submit so the registrant
              knows which tree invited them. The consent line deliberately
              promises no full tree access (R-74.6). */}
          {inviteInfo && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="invite-context">
              <div className="flex items-start space-x-3">
                <Link2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-900 font-medium">
                    {t('invite.contextTitle', { treeName: inviteInfo.treeName })}
                  </p>
                  <p className="text-blue-800 mt-1">
                    {t('invite.contextBody', {
                      inviterName: inviteInfo.inviterName,
                      type: t(`invite.type.${inviteInfo.type}`),
                      expiresAt: formatDateWithLocale(inviteInfo.expiresAt, i18n.language),
                    })}
                  </p>
                  <p className="text-blue-700 mt-1">
                    {t('invite.contextUses', { count: inviteInfo.remainingUses })}
                  </p>
                  <p className="text-blue-700 mt-2 text-xs">{t('invite.consent')}</p>
                </div>
              </div>
            </div>
          )}
          {inviteError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3" data-testid="invite-error">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-red-900 font-medium">{t('invite.deadTitle')}</p>
                <p className="text-red-800 mt-1">{inviteError}</p>
                <p className="text-red-700 mt-1 text-xs">{t('invite.deadBody')}</p>
              </div>
            </div>
          )}

          {/* Pending registration: the server accepted the account (202)
              but no session exists until an owner activates it. */}
          {pendingEmail && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-900 text-sm font-medium">{t('auth.pendingTitle')}</p>
                <p className="text-amber-800 text-sm mt-1">
                  {t('auth.pendingBody', { email: pendingEmail })}
                </p>
              </div>
            </div>
          )}

          {/* Blocked login: the account exists but is not usable yet. */}
          {loginBlock === 'pending' && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-900 text-sm font-medium">{t('auth.loginPendingTitle')}</p>
                <p className="text-amber-800 text-sm mt-1">{t('auth.loginPendingBody')}</p>
              </div>
            </div>
          )}
          {loginBlock === 'disabled' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-900 text-sm font-medium">{t('auth.loginDisabledTitle')}</p>
                <p className="text-red-800 text-sm mt-1">{t('auth.loginDisabledBody')}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-green-800 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {(errors.general || error) && !loginBlock && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-red-800 text-sm">{errors.general ?? error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field (sign up only) */}
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.name')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder={t('auth.namePlaceholder')}
                  />
                </div>
                {errors.name && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.email}</span>
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder={t('auth.passwordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.password}</span>
                </p>
              )}
            </div>

            {/* Forgot Password Link */}
            {!isSignUp && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {t('auth.forgot')}
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? t('auth.signup') : t('auth.signin')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Sign Up / Login */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              {isSignUp ? t('auth.haveAccount') : t('auth.noAccount')}
              <button
                onClick={switchMode}
                className="ml-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                {isSignUp ? t('auth.signinHere') : t('auth.signupHere')}
              </button>
            </p>
          </div>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600 text-center mb-2">{t('auth.demoTitle')}</p>
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>{t('auth.demoEmail')}:</strong> demo@familytree.app</p>
              <p><strong>{t('auth.demoPassword')}:</strong> demo123</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">{t('auth.footer')}</p>
        </div>
      </div>
    </div>
  );
};
