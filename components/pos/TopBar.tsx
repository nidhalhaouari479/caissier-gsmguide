'use client';

import {
  LogOut,
  Package,
  Store,
  Lock,
  ArrowRightLeft,
  RefreshCw,
  Users,
  UserCog,
  FileText,
  Eye,
  ReceiptText,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type NavLink = { href: string; label: string; title: string; Icon: LucideIcon };

const NAV_LINKS: Record<'cashier' | 'manager', NavLink[]> = {
  cashier: [
    { href: '/products', label: 'Articles', title: 'Gérer les articles', Icon: Package },
  ],
  manager: [
    { href: '/products', label: 'Articles', title: 'Gérer les articles', Icon: Package },
    { href: '/cashiers', label: 'Caissiers', title: 'Gérer les caissiers', Icon: UserCog },
    { href: '/customers', label: 'Clients', title: 'Gérer les clients', Icon: Users },
    { href: '/invoices', label: 'Factures', title: 'Factures et commandes', Icon: FileText },
    { href: '/closures', label: 'Clôtures', title: 'Historique des clôtures', Icon: ReceiptText },
    { href: '/logs', label: 'Logs', title: "Journal d'activité", Icon: Eye },
  ],
};

interface TopBarProps {
  variant?: 'cashier' | 'manager';
  cashierName?: string;
  posSessionName?: string;
  storeName?: string;
  boutiqueName?: string;
  storeCompanies?: string[];
  onLogout?: () => void;
  onClosure?: () => void;
  onExpenses?: () => void;
  onRefund?: () => void;
  onRefreshSession?: () => void;
}

function ActionButton({
  onClick,
  title,
  icon,
  label,
  tone,
}: {
  onClick: () => void;
  title: string;
  icon: ReactNode;
  label: string;
  tone: 'orange' | 'amber' | 'blue';
}) {
  const tones = {
    orange: 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40',
    amber: 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40',
    blue: 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40',
  };
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${tones[tone]}`}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

export function TopBar({
  variant = 'cashier',
  cashierName = 'Caissier',
  posSessionName,
  storeName,
  boutiqueName,
  storeCompanies,
  onLogout,
  onClosure,
  onExpenses,
  onRefund,
  onRefreshSession,
}: TopBarProps) {
  const [time, setTime] = useState<string>('');
  const router = useRouter();
  const brandName = process.env.NEXT_PUBLIC_STORE_NAME || 'GSM GUIDE';
  const displayBoutiqueName = boutiqueName || storeName || brandName;
  const storeLogo = process.env.NEXT_PUBLIC_STORE_LOGO || '/gsmguidelogo.png';
  const navLinks = NAV_LINKS[variant];
  const roleLabel = variant === 'manager' ? 'Manager' : 'Caisse';
  const hasActions = Boolean(onExpenses || onRefund || onClosure);
  const otherCompanies = (storeCompanies || []).filter((c) => c !== displayBoutiqueName);

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
          <img
            src={storeLogo}
            alt={brandName}
            className="h-8 w-8 object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <div className="hidden leading-tight md:block">
          <p className="text-base font-black uppercase tracking-tight">{brandName}</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-600">{roleLabel}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex min-w-0 flex-1 justify-center">
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
          {navLinks.map(({ href, label, title, Icon }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              title={title}
              className="flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground hover:shadow-sm"
            >
              <Icon className="h-4 w-4" />
              <span className={navLinks.length > 2 ? 'hidden 2xl:inline' : 'hidden sm:inline'}>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Caisse actions */}
      {hasActions && (
        <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-border p-0.5">
          {onExpenses && (
            <ActionButton
              onClick={onExpenses}
              title="Entrées / Sorties de caisse"
              icon={<ArrowRightLeft className="h-4 w-4" />}
              label="Mouvements"
              tone="orange"
            />
          )}
          {onRefund && (
            <ActionButton
              onClick={onRefund}
              title="Retour / Remboursement"
              icon={<RotateCcw className="h-4 w-4" />}
              label="Retour"
              tone="amber"
            />
          )}
          {onClosure && (
            <ActionButton
              onClick={onClosure}
              title="Clôture de caisse"
              icon={<Lock className="h-4 w-4" />}
              label="Clôture"
              tone="blue"
            />
          )}
        </div>
      )}

      {/* Boutique + user */}
      <div className="flex shrink-0 items-center gap-3 border-l border-border pl-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
          <Store className="h-5 w-5" />
        </div>
        <div className="min-w-0 max-w-[220px] leading-tight">
          <p
            className="truncate text-sm font-bold text-foreground"
            title={otherCompanies.length ? [displayBoutiqueName, ...otherCompanies].join(' · ') : displayBoutiqueName}
          >
            {displayBoutiqueName}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{cashierName}</span>
            {posSessionName && (
              <button
                onClick={onRefreshSession}
                title="Rafraîchir l'état de la session"
                className="flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-1.5 py-px text-[10px] font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40"
              >
                {posSessionName}
                <RefreshCw className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>
        <span className="hidden text-sm font-semibold tabular-nums text-muted-foreground sm:inline">{time}</span>
        {onLogout && (
          <button
            onClick={onLogout}
            title="Se déconnecter"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
