import { parsePrisonerWorkbook, type WorkbookKind } from './prisonerWorkbook';

globalThis.addEventListener('message', (event: MessageEvent<{ data: ArrayBuffer; kind: WorkbookKind }>) => {
  try {
    globalThis.postMessage({ workbook: parsePrisonerWorkbook(event.data.data, event.data.kind) });
  } catch (error) {
    globalThis.postMessage({ error: error instanceof Error ? error.message : 'ไม่สามารถอ่านไฟล์ Excel ได้' });
  }
});
