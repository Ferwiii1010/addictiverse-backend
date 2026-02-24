const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS para permitir que tu reproductor se conecte
app.use(cors({
    origin: '*', // En producción, pon aquí la URL de tu página web
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Permitir recibir JSON en el body de las peticiones
app.use(express.json());

// Ruta de Health Check (Para saber si el servidor está despierto)
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Addictiverse Backend funcionando perfectamente en Node.js' });
});

// Ruta principal que usa tu reproductor
app.post('/', async (req, res) => {
    const { url, action, id } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, message: 'Se requiere una URL' });
    }

    console.log(`Procesando URL: ${url} | Acción: ${action}`);

    try {
        // USO DE YT-DLP (MAGIA REAL): Extrae el link directo (m3u8 o mp4) sin descargar el video
        const videoInfo = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true
        });

        // yt-dlp devuelve una lista de formatos. Buscamos el mejor disponible (hls/m3u8 o mp4)
        let directUrl = videoInfo.url; 
        
        // Si no hay url directa en la raíz, buscamos en los formatos
        if (!directUrl && videoInfo.formats && videoInfo.formats.length > 0) {
            // Priorizamos HLS (.m3u8) si existe
            const hlsFormat = videoInfo.formats.find(f => f.protocol === 'm3u8_native' || f.ext === 'mp4');
            directUrl = hlsFormat ? hlsFormat.url : videoInfo.formats[0].url;
        }

        if (directUrl) {
            return res.json({
                success: true,
                url: directUrl,
                title: videoInfo.title || 'Video Extraído'
            });
        } else {
            return res.json({ success: false, url: url, message: 'No se encontró URL directa' });
        }

    } catch (error) {
        console.error('Error al extraer el video:', error.message);
        
        // Si falla (por ejemplo, si el Drive es privado), devolvemos la URL original como fallback
        // o si es Drive, intentamos devolver un proxy básico
        if (action === 'extract_drive' && id) {
             const driveDirect = `https://drive.google.com/uc?export=download&id=${id}`;
             return res.json({ success: true, url: driveDirect, title: 'Video de Drive (Fallback)' });
        }

        return res.json({ success: false, url: url });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});