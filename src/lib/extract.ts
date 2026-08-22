/**
 * Extracción de texto de PDF y DOCX en el browser.
 * Se cargan vía dynamic import para no pesar el bundle inicial.
 */

export async function extraerTextoPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Dynamic import para no cargar pdfjs-dist en el bundle inicial
  const pdfjs = await import("pdfjs-dist");

  // Desactivar worker para compatibilidad con Vite + dynamic import
  // En archivos de CV (1-5 páginas) el impacto de rendimiento es aceptable
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let texto = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => {
        if (typeof item === "object" && item !== null && "str" in item) {
          return (item as { str: string }).str;
        }
        return "";
      })
      .join(" ");
    texto += pageText + "\n\n";
  }

  return texto.trim();
}

export async function extraerTextoDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

export function detectarTipoArchivo(file: File): "pdf" | "docx" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  return null;
}
