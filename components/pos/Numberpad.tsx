'use client';

import { ArrowLeft, Banknote, Package, Tag, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PadMode = 'qty' | 'disc' | 'price';

interface NumberpadProps {
  onNumber: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  onCustomer?: () => void;
  customerName?: string | null;
  activeMode?: PadMode;
  onModeChange?: (mode: PadMode) => void;
  value: string;
  label?: string;
}

export function Numberpad({
  onNumber,
  onBackspace,
  onClear,
  onSubmit,
  onCustomer,
  customerName,
  activeMode,
  onModeChange,
  value,
  label = 'Valeur',
}: NumberpadProps) {
  const modes: { id: PadMode; label: string; icon: any }[] = [
    { id: 'qty', label: 'Qté', icon: Package },
    { id: 'disc', label: 'Remise', icon: Banknote },
    { id: 'price', label: 'Prix', icon: Tag },
  ];

  return (
    <div className="flex h-full bg-white select-none">
      {/* Mode Sidebar - Only show if onModeChange is provided */}
      {onModeChange && (
        <div className="flex flex-col gap-1 w-16 p-2 border-r border-border bg-slate-50">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 h-14 rounded-md border transition-all",
                activeMode === mode.id
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-white border-border text-muted-foreground hover:bg-slate-50"
              )}
            >
              <mode.icon className="h-4 w-4" />
              <span className="text-[8px] font-bold uppercase">{mode.label}</span>
            </button>
          ))}
          {onCustomer && (
            <button
              onClick={onCustomer}
              className={cn(
                "flex flex-col items-center justify-center gap-1 h-14 rounded-md border transition-all",
                customerName
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-white border-border text-muted-foreground hover:bg-slate-50"
              )}
              title={customerName || 'Passager'}
            >
              <User className="h-4 w-4 shrink-0" />
              <span className="text-[8px] font-bold uppercase overflow-hidden text-ellipsis w-full px-1 whitespace-nowrap text-center">
                {customerName ? customerName.split(' ')[0] : 'Passager'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Main Pad Area */}
      <div className="flex-1 flex flex-col p-3 gap-3">
        {/* Simple Display */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-border rounded-md">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
          <span className="text-xl font-bold tabular-nums text-foreground">{value || '0'}</span>
        </div>

        {/* Numbers Grid */}
        <div className="grid grid-cols-3 gap-2 flex-1">
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'back'].map((key) => {
            if (key === 'back') {
              return (
                <Button
                  key={key}
                  variant="outline"
                  onClick={onBackspace}
                  className="h-full border-border hover:bg-slate-50"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              );
            }
            return (
              <Button
                key={key}
                variant="outline"
                onClick={() => onNumber(key)}
                className="h-full text-lg font-bold border-border hover:bg-slate-50"
              >
                {key}
              </Button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <Button
            variant="outline"
            onClick={onClear}
            className="h-12 border-border font-bold uppercase text-xs"
          >
            Vider
          </Button>
          <Button
            onClick={onSubmit}
            className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase"
          >
            Entrer
          </Button>
        </div>
      </div>
    </div>
  );
}
