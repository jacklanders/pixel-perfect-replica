const LADO_MAXIMO = 512;
const CALIDAD_JPEG = 0.85;
const MARCA = "data:image/jpeg";

export const MAX_ARCHIVO_FOTO_BYTES = 6 * 1024 * 1024;

/**
 * Convierte una foto del CV a un JPEG de ~512px de lado (preservando proporción),
 * para que el `fotoBase64` que se persiste en `structured_json` pese ~20-60 KB en
 * lugar de los varios MB de la foto original (que inflaba cada listado/save de CV).
 */
export async function cargarFotoComprimida(file: File): Promise<string> {
  if (file.size > MAX_ARCHIVO_FOTO_BYTES) {
    throw new Error("La imagen excede el límite de 6MB. Elegí una foto más liviana.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const imagen = await cargarImagen(objectUrl);
    const ladoMayor = Math.max(imagen.naturalWidth, imagen.naturalHeight);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(1, ladoMayor));
    const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
    const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen. Probá con otra foto.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(imagen, 0, 0, ancho, alto);

    return canvas.toDataURL(MARCA, CALIDAD_JPEG);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen. Verificá que sea una foto."));
    img.src = url;
  });
}
