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

    // --- 1. LÓGICA ESPECIAL PARA GOOGLE DRIVE ---
    if (action === 'extract_drive' && id) {
        try {
            // Intentamos extraer información real con yt-dlp primero
            const videoInfo = await youtubedl(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCheckCertificate: true,
                addHeader: ['user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64)']
            });
            
            // Construimos un Proxy interno básico para evitar el Worker de Cloudflare
            const proxyUrl = `https://drive.google.com/uc?export=download&id=${id}`;

            return res.json({
                success: true,
                url: proxyUrl, // Enviamos el proxy en lugar del m3u8 para evitar bloqueos
                title: videoInfo.title || 'Video de Drive'
            });
        } catch (e) {
            console.log("Fallo yt-dlp con Drive, usando fallback directo...");
            const fallbackUrl = `https://drive.google.com/uc?export=download&id=${id}`;
            return res.json({ success: true, url: fallbackUrl, title: 'Video de Drive' });
        }
    }

    // --- 2. LÓGICA PARA YOUTUBE, TIKTOK, INSTAGRAM, ETC. ---
    const isSocialMedia = /(youtube\.com|youtu\.be|instagram\.com|twitter\.com|x\.com|tiktok\.com)/i.test(url);

    if (isSocialMedia) {
        console.log("Red social detectada. Usando API de Cobalt...");
        const cobaltInstances = ['https://api.cobalt.tools/api/json', 'https://co.wuk.sh/api/json'];
        
        for (const instance of cobaltInstances) {
            try {
                const cobaltRes = await fetch(instance, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ url: url, vQuality: '1080' })
                });
                
                if (cobaltRes.ok) {
                    const data = await cobaltRes.json();
                    if (data && data.url) {
                        return res.json({
                            success: true,
                            url: data.url,
                            title: 'Video de Red Social' 
                        });
                    }
                }
            } catch(e) {
                console.log(`Fallo la instancia de Cobalt: ${instance}`);
            }
        }
    }

    // --- 3. LÓGICA PARA OTROS SITIOS WEB (Uso general de yt-dlp) ---
    try {
        console.log("Intentando extracción general con yt-dlp...");
        const videoInfo = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            addHeader: ['user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64)']
        });

        let directUrl = videoInfo.url; 
        if (!directUrl && videoInfo.formats && videoInfo.formats.length > 0) {
            const hlsFormat = videoInfo.formats.find(f => f.protocol === 'm3u8_native' || f.ext === 'mp4');
            directUrl = hlsFormat ? hlsFormat.url : videoInfo.formats[0].url;
        }

        if (directUrl) {
            return res.json({ success: true, url: directUrl, title: videoInfo.title });
        } else {
            return res.json({ success: false, url: url, message: 'No se encontró URL directa' });
        }
    } catch (error) {
        console.error('Error general yt-dlp:', error.message);
        return res.json({ success: false, url: url, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});
