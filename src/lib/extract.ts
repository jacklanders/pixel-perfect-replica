/**
 * Extracción de texto de PDF y DOCX en el browser.
 * Se cargan vía dynamic import para no pesar el bundle inicial.
 */
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export async function extraerTextoPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Dynamic import para no cargar pdfjs-dist en el bundle inicial
  const pdfjs = await import("pdfjs-dist");

  // Worker externo: pdf.js v6 exige workerSrc ("" invalida el build y
  // lanza "No 'GlobalWorkerOptions.workerSrc' specified."). Vite lo
  // emite como asset y lo sirve en el mismo origen.
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (err) {
    if (err instanceof Error && /unsupported|corrupt|invalid|file in options/i.test(err.message)) {
      throw new Error(
        `No se pudo leer el .docx (¿está dañado o es un .doc antiguo?): ${err.message}`,
      );
    }
    throw err;
  }
}

export async function detectarTipoArchivo(file: File): Promise<"pdf" | "docx" | "doc" | null> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (!name.endsWith(".docx") && !name.endsWith(".doc")) return null;

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const esZip = header[0] === 0x50 && header[1] === 0x4b;
  const esOle =
    header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0;

  if (esOle) return "doc";
  if (esZip) return "docx";
  return name.endsWith(".docx") ? "doc" : null;
}
