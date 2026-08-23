export interface MediaRenderJob {
  quoteId: string;
  tenantId: string;
  pdfUrl?: string;
  sketchUrl?: string;
  status: 'completed' | 'failed';
  error?: string;
}

export async function processMediaJob(quoteId: string, tenantId: string): Promise<MediaRenderJob> {
  try {
    const pdfUrl = `/storage/${tenantId}/quotations/${quoteId}/quote_${quoteId}.pdf`;
    const sketchUrl = `/storage/${tenantId}/quotations/${quoteId}/sketch_${quoteId}.png`;

    return {
      quoteId,
      tenantId,
      pdfUrl,
      sketchUrl,
      status: 'completed',
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown rendering failure';
    return {
      quoteId,
      tenantId,
      status: 'failed',
      error: errorMessage,
    };
  }
}
