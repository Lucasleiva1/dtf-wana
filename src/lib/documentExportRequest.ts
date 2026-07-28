import { useEffect, useRef } from "react";

export const documentExportRequestEvent = "dtf:export-document";

export function requestDocumentExport() {
  window.dispatchEvent(new Event(documentExportRequestEvent));
}

export function useDocumentExportRequest(handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onRequest = () => handlerRef.current();
    window.addEventListener(documentExportRequestEvent, onRequest);
    return () => window.removeEventListener(documentExportRequestEvent, onRequest);
  }, []);
}
