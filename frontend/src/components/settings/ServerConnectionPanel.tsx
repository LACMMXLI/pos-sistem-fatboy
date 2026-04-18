import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Loader2,
  Lock,
  PlugZap,
  Save,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';
import ActionButton from '@/components/ui/ActionButton';
import {
  getDesktopServerConfig,
  isDesktopRuntime,
  saveDesktopServerConfig,
  testDesktopServerConfig,
  type DesktopServerConnectionConfig,
  type DesktopServerConnectionTestResult,
} from '@/lib/runtime';
import { cn } from '@/lib/utils';

type ServerConnectionPanelProps = {
  standalone?: boolean;
  setupMode?: boolean;
  startupReason?: string | null;
  startupError?: string | null;
};

type FormState = {
  protocol: 'http' | 'https';
  host: string;
  port: string;
};

type FormErrors = Partial<Record<'protocol' | 'host' | 'port', string>>;

const fieldClass =
  'w-full rounded-[0.9rem] border border-white/10 bg-black/22 px-3 py-2.5 text-[12px] font-semibold text-on-surface outline-none transition-all placeholder:text-outline/70';

function toFingerprint(form: FormState) {
  return `${form.protocol}://${form.host.trim().toLowerCase()}:${form.port.trim()}`;
}

function getReasonCopy(reason?: string | null) {
  if (reason === 'backend-unreachable') {
    return {
      title: 'No se pudo usar la configuración guardada',
      message: 'Revisa host, puerto o protocolo para restablecer la conexión con el backend.',
    };
  }

  return {
    title: 'Configura el backend antes de continuar',
    message: 'Esta instalación necesita una conexión válida para abrir el sistema principal.',
  };
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!['http', 'https'].includes(form.protocol)) {
    errors.protocol = 'Selecciona un protocolo válido.';
  }

  const host = form.host.trim();
  if (!host) {
    errors.host = 'Captura un host o IP.';
  } else if (/\s/.test(host) || host.includes('/') || host.includes('://')) {
    errors.host = 'El host o IP no es válido.';
  }

  const portValue = form.port.trim();
  if (!portValue) {
    errors.port = 'Captura un puerto.';
  } else if (!/^\d+$/.test(portValue)) {
    errors.port = 'El puerto debe ser numérico.';
  } else {
    const port = Number(portValue);
    if (port < 1 || port > 65535) {
      errors.port = 'El puerto debe estar entre 1 y 65535.';
    }
  }

  return errors;
}

function normalizeFormToPayload(form: FormState): DesktopServerConnectionConfig {
  return {
    protocol: form.protocol,
    host: form.host.trim(),
    port: Number(form.port.trim()),
  };
}

export function ServerConnectionPanel({
  standalone = false,
  setupMode = false,
  startupReason,
  startupError,
}: ServerConnectionPanelProps) {
  const desktopMode = isDesktopRuntime();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasSavedConfig, setHasSavedConfig] = useState(false);
  const [form, setForm] = useState<FormState>({
    protocol: 'http',
    host: '',
    port: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [testResult, setTestResult] = useState<DesktopServerConnectionTestResult | null>(null);
  const [lastSuccessfulFingerprint, setLastSuccessfulFingerprint] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      if (!desktopMode) {
        setLoading(false);
        return;
      }

      const state = await getDesktopServerConfig();
      if (!active || !state) {
        setLoading(false);
        return;
      }

      const baseConfig = state.hasSavedConfig ? state.config : state.defaults;
      setHasSavedConfig(state.hasSavedConfig);
      setForm({
        protocol: baseConfig.protocol,
        host: baseConfig.host,
        port: String(baseConfig.port),
      });
      setLoading(false);
    }

    void loadConfig();

    return () => {
      active = false;
    };
  }, [desktopMode]);

  const reasonCopy = useMemo(() => getReasonCopy(startupReason), [startupReason]);
  const currentFingerprint = useMemo(() => toFingerprint(form), [form]);
  const canSave = lastSuccessfulFingerprint === currentFingerprint && !saving && !testing;

  const handleFieldChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));

    if (lastSuccessfulFingerprint && currentFingerprint !== toFingerprint({ ...form, [field]: value } as FormState)) {
      setLastSuccessfulFingerprint(null);
    }
  };

  const runTest = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setTestResult(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setTesting(true);
    const result = await testDesktopServerConfig(normalizeFormToPayload(form));
    setTesting(false);
    setTestResult(result ?? null);

    if (result?.ok) {
      setLastSuccessfulFingerprint(currentFingerprint);
      return;
    }

    setLastSuccessfulFingerprint(null);
  };

  const handleSave = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);

    try {
      await saveDesktopServerConfig(normalizeFormToPayload(form));
      toast.success('Configuración del servidor guardada.');

      if (!standalone) {
        window.setTimeout(() => window.location.reload(), 500);
      }
    } catch (error: any) {
      const message = error?.message || 'No se pudo guardar la configuración del servidor.';
      setTestResult({
        ok: false,
        code: 'SAVE_FAILED',
        message,
      });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!desktopMode) {
    return (
      <div className="admin-card p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-error">Disponible solo en Electron</p>
      </div>
    );
  }

  return (
    <div className={cn(standalone ? 'mx-auto w-full max-w-[31rem]' : 'w-full')}>
      <div className={cn(standalone ? 'admin-panel overflow-hidden' : 'admin-card overflow-hidden')}>
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/80">Servidor</p>
            <h2 className="mt-1 text-[1.05rem] font-headline font-black uppercase tracking-[0.06em] text-on-surface">
              Configuración de conexión
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="admin-chip">
              <Server className="h-3.5 w-3.5" />
              {hasSavedConfig ? 'Configurado' : 'Primer arranque'}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {(setupMode || startupReason) && (
            <div className="rounded-[0.95rem] border border-primary/20 bg-primary/8 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-start gap-2.5">
                <div className="rounded-full border border-primary/30 bg-primary/12 p-1.5 text-primary">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-on-surface">{reasonCopy.title}</p>
                  {startupError ? (
                    <p className="mt-1 text-[11px] font-semibold leading-4 text-error">{startupError}</p>
                  ) : <p className="mt-1 text-[11px] leading-4 text-on-surface-variant">{reasonCopy.message}</p>}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[0.78fr_1.18fr_0.7fr]">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-outline">Protocolo</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                <select
                  value={form.protocol}
                  onChange={(event) => handleFieldChange('protocol', event.target.value)}
                  className={cn(fieldClass, 'pl-10')}
                >
                  <option value="http">http</option>
                  <option value="https">https</option>
                </select>
              </div>
              {errors.protocol ? <p className="mt-1 text-[10px] font-semibold text-error">{errors.protocol}</p> : null}
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-outline">Host / IP</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                <input
                  value={form.host}
                  onChange={(event) => handleFieldChange('host', event.target.value)}
                  className={cn(fieldClass, 'pl-10')}
                  placeholder="192.168.1.50 o servidor.local"
                  autoFocus={standalone}
                />
              </div>
              {errors.host ? <p className="mt-1 text-[10px] font-semibold text-error">{errors.host}</p> : null}
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-outline">Puerto</label>
              <input
                value={form.port}
                onChange={(event) => handleFieldChange('port', event.target.value)}
                className={fieldClass}
                inputMode="numeric"
                placeholder="3000"
              />
              {errors.port ? <p className="mt-1 text-[10px] font-semibold text-error">{errors.port}</p> : null}
            </div>
          </div>

          <div className="rounded-[0.95rem] border border-white/8 bg-black/15 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-outline">Destino</p>
            <p className="mt-1.5 break-all font-mono text-[13px] text-on-surface">
                {form.protocol}://{form.host.trim() || 'host'}:{form.port.trim() || 'puerto'}
            </p>
          </div>

          <div
            className={cn(
              'rounded-[0.95rem] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
              !testResult
                ? 'border-white/8 bg-black/15'
                : testResult.ok
                  ? 'border-emerald-400/20 bg-emerald-500/8'
                  : 'border-error/20 bg-error-container/12',
            )}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={cn(
                  'rounded-full border p-1.5',
                  !testResult
                    ? 'border-white/10 text-outline'
                    : testResult.ok
                      ? 'border-emerald-400/30 text-emerald-300'
                      : 'border-error/30 text-error',
                )}
              >
                {!testResult ? (
                  <Server className="h-4 w-4" />
                ) : testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-on-surface">
                  {!testResult
                    ? 'Sin prueba reciente'
                    : testResult.ok
                      ? 'Conexión exitosa'
                      : 'Conexión fallida'}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-on-surface-variant">
                  {!testResult
                    ? 'Presiona Probar conexión.'
                    : testResult.message}
                </p>
                {testResult?.details ? (
                  <p className="mt-1.5 break-all text-[10px] leading-4 text-outline">{testResult.details}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-white/8 pt-3 sm:flex-row sm:justify-end">
            <div className="flex flex-col gap-2 sm:flex-row">
              <ActionButton variant="secondary" onClick={runTest} disabled={loading || testing || saving}>
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                Probar conexión
              </ActionButton>
              <ActionButton onClick={handleSave} disabled={loading || !canSave}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Guardar configuración
              </ActionButton>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="border-t border-white/8 px-4 py-3 text-[11px] font-semibold text-outline">
            Cargando configuración local...
          </div>
        ) : null}
      </div>
    </div>
  );
}
