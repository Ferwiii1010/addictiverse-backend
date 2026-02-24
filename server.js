const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Addictiverse Backend funcionando perfectamente en Node.js' });
});

app.post('/', async (req, res) => {
    const { url, action, id } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, message: 'Se requiere una URL' });
    }

    console.log(`Procesando URL: ${url} | Acción: ${action}`);

    try {
        // YT-DLP optimizado (se quitaron las opciones obsoletas)
        // Se agregó un "User-Agent" para disimular que somos un servidor
        const videoInfo = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });

        let directUrl = videoInfo.url; 
        
        if (!directUrl && videoInfo.formats && videoInfo.formats.length > 0) {
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
        
        // Si YT-DLP falla por anti-bots, recurrimos al plan B de Google Drive
        if (action === 'extract_drive' && id) {
             const driveDirect = `https://drive.google.com/uc?export=download&id=${id}`;
             return res.json({ success: true, url: driveDirect, title: 'Video de Drive (Fallback)' });
        }

        return res.json({ success: false, url: url, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});
