import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface PayButtonProps {
  total: number;
  disabled?: boolean;
  onClick: () => void;
}

export function PayButton({ total, disabled = false, onClick }: PayButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
    >
      Paiement <ArrowRight className="h-4 w-4" />
    </Button>
  );
}
