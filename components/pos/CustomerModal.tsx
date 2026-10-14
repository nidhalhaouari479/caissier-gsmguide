'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, X, User, Phone, Mail, Smartphone, MapPin, Building2, Hash, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOdooCustomers, Customer } from '@/hooks/useOdooCustomers';

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCustomerSelect: (customer: Customer | null) => void;
}

export function CustomerModal({ open, onClose, onCustomerSelect }: CustomerModalProps) {
  const { customers, isLoading, createCustomer } = useOdooCustomers();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [vat, setVat] = useState('');

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (typeof c.phone === 'string' && c.phone.toLowerCase().includes(q)) ||
      (typeof c.mobile === 'string' && c.mobile.toLowerCase().includes(q)) ||
      (typeof c.email === 'string' && c.email.toLowerCase().includes(q))
    );
  });

  const resetForm = () => {
    setName(''); setPhone(''); setMobile('');
    setEmail(''); setStreet(''); setCity(''); setVat('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSubmitting(true);
    try {
      const newCustomer = await createCustomer({ name, phone, mobile, email, street, city, vat });
      if (newCustomer) {
        toast({ description: "Client créé avec succès." });
        onCustomerSelect(newCustomer);
        onClose();
        resetForm();
        setIsCreating(false);
      }
    } catch (error) {
      toast({ variant: "destructive", description: "Erreur lors de la création du client." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && !isSubmitting) onClose(); }}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden border border-border bg-white dark:bg-zinc-900 rounded-lg shadow-xl flex flex-col h-[85vh]">
        {/* Clean Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-slate-50/50 dark:bg-zinc-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-tight">
                {isCreating ? 'Nouveau Client' : 'Clients'}
              </DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {isCreating ? 'Ajouter un client à Odoo' : 'Sélectionner ou rechercher'}
              </DialogDescription>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isCreating ? (
            <form onSubmit={handleCreate} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nom complet *</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
                    <Input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="h-11 pl-10 text-sm font-bold bg-transparent border-border focus-visible:ring-blue-500"
                      placeholder="Nom du client"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Téléphone</label>
                    <div className="relative group">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
                      <Input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="h-11 pl-10 text-sm bg-transparent border-border focus-visible:ring-blue-500"
                        placeholder="+216 XX XXX XXX"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mobile</label>
                    <div className="relative group">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
                      <Input
                        type="tel"
                        value={mobile}
                        onChange={e => setMobile(e.target.value)}
                        className="h-11 pl-10 text-sm bg-transparent border-border focus-visible:ring-blue-500"
                        placeholder="+216 XX XXX XXX"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">E-mail</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="h-11 pl-10 text-sm bg-transparent border-border focus-visible:ring-blue-500"
                      placeholder="client@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ville</label>
                    <div className="relative group">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
                      <Input
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        className="h-11 pl-10 text-sm bg-transparent border-border focus-visible:ring-blue-500"
                        placeholder="Ville"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">N° TVA</label>
                    <div className="relative group">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
                      <Input
                        type="text"
                        value={vat}
                        onChange={e => setVat(e.target.value)}
                        className="h-11 pl-10 text-sm bg-transparent border-border focus-visible:ring-blue-500"
                        placeholder="MF / N° TVA"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsCreating(false); resetForm(); }}
                  className="flex-1 h-11 text-xs font-bold uppercase tracking-wider"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !name}
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 h-full flex flex-col animate-in fade-in slide-in-from-left-4 duration-200">
              <div className="flex gap-2">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
                  <Input
                    type="text"
                    placeholder="Rechercher un client..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 pl-10 text-sm bg-transparent border-border focus-visible:ring-blue-500"
                  />
                </div>
                <Button
                  onClick={() => setIsCreating(true)}
                  className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau
                </Button>
              </div>

              <Button
                onClick={() => { onCustomerSelect({ id: 'PASSAGER', name: 'Passager' } as any); onClose(); }}
                variant="outline"
                className="w-full h-11 border-dashed border-2 border-slate-300 dark:border-zinc-700 text-muted-foreground font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-zinc-800"
              >
                Continuer sans client (Passager)
              </Button>

              <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-slate-50/30 dark:bg-zinc-800/20 custom-scrollbar">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Chargement...</p>
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2 opacity-50">
                    <User className="h-8 w-8 text-muted-foreground" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Aucun client</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => { onCustomerSelect(customer); onClose(); }}
                        className="w-full flex items-center justify-between p-4 hover:bg-white dark:hover:bg-zinc-800 transition-colors text-left gap-4 group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-foreground group-hover:text-blue-600 transition-colors">{customer.name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 opacity-70">
                            {customer.phone && (
                              <span className="text-[10px] flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {customer.phone}
                              </span>
                            )}
                            {customer.mobile && (
                              <span className="text-[10px] flex items-center gap-1">
                                <Smartphone className="h-3 w-3" /> {customer.mobile}
                              </span>
                            )}
                            {customer.email && (
                              <span className="text-[10px] flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {customer.email}
                              </span>
                            )}
                            {customer.city && (
                              <span className="text-[10px] flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {customer.city}
                              </span>
                            )}
                          </div>
                        </div>
                        {customer.vat ? (
                          <span className="text-[9px] font-bold bg-slate-100 dark:bg-zinc-700 text-muted-foreground px-2 py-0.5 rounded uppercase shrink-0">
                            TVA: {customer.vat}
                          </span>
                        ) : (
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
