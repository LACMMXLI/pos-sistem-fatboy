import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Loader2, Printer, RefreshCw, Save, Copy, History, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ActionButton from '../../components/ui/ActionButton';
import {
  activatePrintTemplate,
  createPrintTemplate,
  duplicatePrintTemplate,
  getPrintJobs,
  getPrintTemplateTypes,
  getPrintTemplates,
  previewPrintTemplate,
  reprintPrintJob,
  restoreDefaultPrintTemplate,
  testPrintDocument,
  updatePrintTemplate,
  type PrintJobResponse,
  type PrintTemplateResponse,
  type PrintTemplateSectionResponse,
} from '../../services/api';
import { cn } from '../../lib/utils';

const fieldClass =
  'w-full bg-surface-container-highest border border-outline-variant/20 px-2 py-1.5 text-[10px] font-bold text-on-surface outline-none focus:border-primary transition-colors hover:border-outline-variant/40';

const fieldClassCompact =
  'w-full bg-surface-container-highest border border-outline-variant/10 px-1.5 py-1 text-[9px] font-bold text-on-surface outline-none focus:border-primary transition-colors';

export function PrintingCenterScreen() {
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = useState('FAST_FOOD_RECEIPT');
  const [paperWidth, setPaperWidth] = useState<'58' | '80'>('80');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [orderIdPreview, setOrderIdPreview] = useState('');
  const [shiftIdPreview, setShiftIdPreview] = useState('');
  const [cashMovementIdPreview, setCashMovementIdPreview] = useState('');
  const [draft, setDraft] = useState<PrintTemplateResponse | null>(null);

  const { data: templateTypes = [] } = useQuery({
    queryKey: ['print-template-types'],
    queryFn: getPrintTemplateTypes,
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<PrintTemplateResponse[]>({
    queryKey: ['print-templates', documentType, paperWidth],
    queryFn: () => getPrintTemplates({ documentType, paperWidth }),
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<PrintJobResponse[]>({
    queryKey: ['print-jobs-admin'],
    queryFn: () => getPrintJobs(),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!templates.length) {
      setSelectedTemplateId(null);
      setDraft(null);
      return;
    }

    const activeTemplate =
      templates.find((template) => template.isActive) ??
      templates[0];

    const nextSelected =
      templates.some((template) => template.id === selectedTemplateId)
        ? selectedTemplateId
        : activeTemplate.id;

    setSelectedTemplateId(nextSelected ?? null);
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setDraft(null);
      return;
    }

    const template = templates.find((entry) => entry.id === selectedTemplateId) ?? null;
    setDraft(template ? JSON.parse(JSON.stringify(template)) : null);
  }, [selectedTemplateId, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const previewQuery = useQuery({
    queryKey: ['print-preview', draft?.id, documentType, paperWidth, orderIdPreview, shiftIdPreview, cashMovementIdPreview],
    queryFn: () =>
      previewPrintTemplate({
        documentType,
        paperWidth,
        templateId: draft?.id,
        orderId: orderIdPreview ? Number(orderIdPreview) : undefined,
        shiftId: shiftIdPreview ? Number(shiftIdPreview) : undefined,
        cashMovementId: cashMovementIdPreview ? Number(cashMovementIdPreview) : undefined,
      }),
    enabled: !!draft,
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No hay plantilla seleccionada');

      const payload = {
        name: draft.name,
        sections: draft.sections,
        fixedTexts: draft.fixedTexts,
        metadata: draft.metadata,
        printerRouting: draft.printerRouting,
      };

      if (draft.id) {
        return updatePrintTemplate(draft.id, payload);
      }

      return createPrintTemplate({
        ...payload,
        documentType,
        paperWidth,
      });
    },
    onSuccess: () => {
      toast.success('Plantilla guardada');
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
      queryClient.invalidateQueries({ queryKey: ['print-preview'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar'),
  });

  const activateTemplate = useMutation({
    mutationFn: (id: number) => activatePrintTemplate(id),
    onSuccess: () => {
      toast.success('Plantilla activada');
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'No se pudo activar la plantilla'),
  });

  const duplicateTemplate = useMutation({
    mutationFn: (id: number) => duplicatePrintTemplate(id),
    onSuccess: () => {
      toast.success('Plantilla duplicada');
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'No se pudo duplicar la plantilla'),
  });

  const restoreTemplate = useMutation({
    mutationFn: () => restoreDefaultPrintTemplate({ documentType, paperWidth }),
    onSuccess: () => {
      toast.success('Plantilla por defecto restaurada');
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'No se pudo restaurar la plantilla'),
  });

  const printTest = useMutation({
    mutationFn: () =>
      testPrintDocument({
        documentType,
        paperWidth,
        message: `Prueba ${documentType} ${paperWidth}mm`,
      }),
    onSuccess: () => toast.success('Prueba de impresión enviada'),
    onError: (error: any) => toast.error(error?.message || 'No se pudo imprimir la prueba'),
  });

  const reprintJob = useMutation({
    mutationFn: (jobId: string) => reprintPrintJob(jobId),
    onSuccess: () => {
      toast.success('Reimpresión solicitada');
      queryClient.invalidateQueries({ queryKey: ['print-jobs-admin'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || 'No se pudo reimprimir'),
  });

  const updateSection = (
    sectionId: string,
    patch: Partial<PrintTemplateSectionResponse>,
  ) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) =>
          section.key === sectionId ? { ...section, ...patch } : section,
        ),
      };
    });
  };

  const orderedSections = [...(draft?.sections ?? [])].sort((a, b) => a.order - b.order);
  const filteredJobs = jobs.slice(0, 24);

  return (
    <div className="h-full p-1 bg-surface-container-lowest">
      <div className="grid h-full grid-cols-[280px_1fr_380px] gap-1 overflow-hidden">
        <div className="min-h-0 overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl">
          <div className="border-b border-outline-variant/10 bg-surface-container-lowest px-3 py-2">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-on-surface">Plantillas</p>
            <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">Versiones activas por documento y ancho</p>
          </div>
          <div className="space-y-2 p-3">
            <Field label="Documento">
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={fieldClass}>
                {templateTypes.map((entry: any) => (
                  <option key={entry.documentType} value={entry.documentType}>
                    {entry.documentType}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Papel">
              <select value={paperWidth} onChange={(e) => setPaperWidth(e.target.value as '58' | '80')} className={fieldClass}>
                <option value="80">80 mm</option>
                <option value="58">58 mm</option>
              </select>
            </Field>
          </div>
          <div className="max-h-[calc(100%-120px)] overflow-y-auto custom-scrollbar px-2 pb-3">
            {loadingTemplates ? (
              <div className="px-3 py-6 text-center text-[8px] font-bold uppercase tracking-[0.12em] text-outline">Cargando plantillas...</div>
            ) : templates.length === 0 ? (
              <div className="px-3 py-6 text-center text-[8px] font-bold uppercase tracking-[0.12em] text-outline">No hay plantillas para este filtro.</div>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={cn(
                    'mb-2 w-full border px-3 py-2 text-left transition-colors',
                    selectedTemplateId === template.id
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-outline-variant/10 bg-surface-container-high hover:border-primary/20',
                  )}
                >
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-on-surface">{template.name}</p>
                  <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">
                    v{template.version} · {template.isActive ? 'ACTIVA' : 'INACTIVA'} · {template.isDefault ? 'DEFAULT' : 'CUSTOM'}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="min-h-0 overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl">
          <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest px-3 py-2">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-on-surface">Editor por bloques</p>
              <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">Sin edición cruda ESC/POS</p>
            </div>
            <div className="flex gap-1">
              <ActionButton variant="secondary" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['print-preview'] })}>
                <RefreshCw className="w-3 h-3" />
                Preview
              </ActionButton>
              <ActionButton variant="primary" size="sm" onClick={() => saveTemplate.mutate()} disabled={!draft || saveTemplate.isPending}>
                {saveTemplate.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </ActionButton>
            </div>
          </div>
          {draft ? (
            <div className="grid h-[calc(100%-48px)] grid-cols-[220px_minmax(0,1fr)]">
              <div className="border-r border-outline-variant/10 bg-surface-container-high p-3">
                <Field label="Nombre">
                  <input className={fieldClass} value={draft.name} onChange={(e) => setDraft((current) => current ? { ...current, name: e.target.value } : current)} />
                </Field>
                <div className="mt-3 space-y-2">
                  <ActionButton variant="secondary" size="sm" fullWidth onClick={() => duplicateTemplate.mutate(draft.id)} disabled={duplicateTemplate.isPending}>
                    <Copy className="w-3 h-3" />
                    Duplicar
                  </ActionButton>
                  <ActionButton variant="secondary" size="sm" fullWidth onClick={() => activateTemplate.mutate(draft.id)} disabled={activateTemplate.isPending || draft.isActive}>
                    <Sparkles className="w-3 h-3" />
                    Activar
                  </ActionButton>
                  <ActionButton variant="secondary" size="sm" fullWidth onClick={() => restoreTemplate.mutate()} disabled={restoreTemplate.isPending}>
                    <RefreshCw className="w-3 h-3" />
                    Restaurar default
                  </ActionButton>
                </div>
                <div className="mt-4 border border-outline-variant/10 bg-surface-container-lowest p-2">
                  <p className="text-[7px] font-black uppercase tracking-[0.14em] text-outline">Advertencias</p>
                  {(draft.warnings?.length ?? 0) > 0 ? (
                    draft.warnings?.map((warning) => (
                      <p key={warning} className="mt-1 text-[8px] font-bold uppercase tracking-[0.08em] text-amber-200">{warning}</p>
                    ))
                  ) : (
                    <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.08em] text-outline">Sin advertencias registradas.</p>
                  )}
                </div>
              </div>

              <div className="min-h-0 overflow-hidden p-0">
                <table className="w-full text-left border-collapse border-spacing-0">
                  <thead className="sticky top-0 bg-surface-container-lowest z-10 shadow-sm">
                    <tr>
                      <th className="p-2 text-[7px] font-black uppercase tracking-[0.12em] text-outline border-b border-outline-variant/10">Bloque</th>
                      <th className="p-2 text-[7px] font-black uppercase tracking-[0.12em] text-outline border-b border-outline-variant/10">Etiqueta</th>
                      <th className="p-2 text-[7px] font-black uppercase tracking-[0.12em] text-outline border-b border-outline-variant/10 w-16 text-center">Orden</th>
                      <th className="p-2 text-[7px] font-black uppercase tracking-[0.12em] text-outline border-b border-outline-variant/10 w-24">Ali</th>
                      <th className="p-2 text-[7px] font-black uppercase tracking-[0.12em] text-outline border-b border-outline-variant/10 w-24">Tam</th>
                      <th className="p-2 text-[7px] font-black uppercase tracking-[0.12em] text-outline border-b border-outline-variant/10 w-10 text-center">On</th>
                      <th className="p-2 text-[7px] font-black uppercase tracking-[0.12em] text-outline border-b border-outline-variant/10 w-10 text-center">B</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {orderedSections.map((section) => (
                      <tr key={section.key} className={cn("hover:bg-surface-container-highest/50 transition-colors", !section.enabled && "opacity-40 grayscale-[0.5]")}>
                        <td className="p-2 text-[8px] font-black uppercase text-on-surface/50 whitespace-nowrap">{section.key}</td>
                        <td className="p-2">
                          <input
                            className={fieldClassCompact}
                            value={section.customLabel ?? ''}
                            placeholder={section.key}
                            onChange={(e) => updateSection(section.key, { customLabel: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <input className={cn(fieldClassCompact, "text-center")} type="number" value={section.order} onChange={(e) => updateSection(section.key, { order: Number(e.target.value) })} />
                        </td>
                        <td className="p-2">
                          <select className={fieldClassCompact} value={section.alignment} onChange={(e) => updateSection(section.key, { alignment: e.target.value as any })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select className={fieldClassCompact} value={section.fontSize} onChange={(e) => updateSection(section.key, { fontSize: e.target.value as any })}>
                            <option value="small">Small</option>
                            <option value="normal">Normal</option>
                            <option value="large">Large</option>
                            <option value="xlarge">XLarge</option>
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          <input type="checkbox" checked={section.enabled} onChange={(e) => updateSection(section.key, { enabled: e.target.checked })} className="accent-primary" />
                        </td>
                        <td className="p-2 text-center">
                          <input type="checkbox" checked={section.bold} onChange={(e) => updateSection(section.key, { bold: e.target.checked })} className="accent-primary" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex h-[calc(100%-48px)] items-center justify-center text-[9px] font-bold uppercase tracking-[0.12em] text-outline">
              Selecciona una plantilla para editar.
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl">
          <div className="border-b border-outline-variant/10 bg-surface-container-lowest px-3 py-2">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-on-surface">Preview y cola</p>
            <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">Vista previa, prueba y reimpresión</p>
          </div>
          <div className="grid h-[calc(100%-48px)] grid-rows-[auto_1fr_auto] gap-2 p-3">
            <div className="border border-outline-variant/10 bg-surface-container-high p-2.5">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Orden real">
                  <input className={fieldClass} value={orderIdPreview} onChange={(e) => setOrderIdPreview(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 123" />
                </Field>
                <Field label="Turno real">
                  <input className={fieldClass} value={shiftIdPreview} onChange={(e) => setShiftIdPreview(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 5" />
                </Field>
                <Field label="Movimiento">
                  <input className={fieldClass} value={cashMovementIdPreview} onChange={(e) => setCashMovementIdPreview(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 77" />
                </Field>
              </div>
              <div className="mt-2 flex gap-1">
                <ActionButton variant="secondary" size="sm" onClick={() => previewQuery.refetch()}>
                  <Eye className="w-3 h-3" />
                  Refrescar preview
                </ActionButton>
                <ActionButton variant="secondary" size="sm" onClick={() => printTest.mutate()} disabled={printTest.isPending}>
                  {printTest.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                  Prueba física
                </ActionButton>
              </div>
            </div>

              <div className="grid min-h-0 grid-rows-[1fr_auto] gap-2">
                <div className="min-h-0 overflow-hidden border border-outline-variant/10 bg-surface-container-high">
                  <div className="border-b border-outline-variant/10 px-3 py-2 text-[7px] font-black uppercase tracking-[0.14em] text-outline flex justify-between items-center">
                    <span>{previewQuery.isLoading ? 'Generando preview...' : 'Vista previa'}</span>
                    <span className="text-primary/70">{paperWidth}mm</span>
                  </div>
                  <div className="h-[calc(100%-33px)] overflow-y-auto whitespace-pre-wrap bg-[#fffdf8] px-4 py-4 font-mono text-[11px] leading-5 text-[#1a1a1a] shadow-inner custom-scrollbar selection:bg-primary/20">
                    {previewQuery.data?.rendered?.previewText || 'Selecciona una plantilla.'}
                  </div>
                </div>

                <div className="min-h-0 overflow-hidden border border-outline-variant/10 bg-surface-container-high">
                  <div className="border-b border-outline-variant/10 px-3 py-1.5 text-[7px] font-black uppercase tracking-[0.14em] text-outline flex justify-between items-center">
                    <span>Historial</span>
                    <ActionButton variant="secondary" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['print-jobs-admin'] })} className="h-5 px-1.5 !text-[6px]">
                      Sync
                    </ActionButton>
                  </div>
                  <div className="max-h-[160px] overflow-y-auto custom-scrollbar">
                    {filteredJobs.map((job) => (
                      <div key={job.id} className="border-b border-outline-variant/10 px-3 py-1.5 last:border-b-0 hover:bg-surface-container-highest transition-colors group">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[7px] font-black uppercase text-on-surface">{job.documentType}</p>
                            <p className="text-[6px] font-bold text-outline">
                               {new Date(job.createdAt).toLocaleTimeString('es-MX', { hour12: false })} · {job.status}
                            </p>
                          </div>
                          <button onClick={() => reprintJob.mutate(job.id)} disabled={reprintJob.isPending} className="p-1 text-outline hover:text-primary transition-colors">
                            <History className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            <div className="border border-outline-variant/10 bg-surface-container-high px-3 py-2">
              <p className="text-[7px] font-black uppercase tracking-[0.14em] text-outline">
                Documento seleccionado: {selectedTemplate?.documentType || documentType} · Papel {paperWidth}mm
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-0.5 block text-[6px] font-black uppercase tracking-[0.12em] text-outline">{label}</label>
      {children}
    </div>
  );
}
