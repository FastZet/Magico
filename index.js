const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// --- MANIFEST ---
// This is a "search-only" manifest. It tells Stremio that this addon
// doesn't have its own catalog page, it ONLY responds to search queries.
const manifest = {
    id: 'com.yourusername.stremthru.search',
    version: '1.1.0', // Incremented version
    name: 'StremThru Search (Direct)',
    description: 'A direct search addon for Stremio using StremThru.',
    types: ['movie', 'series', 'other'], // We will respond to any search type
    resources: [
        // This is the key change. We tell Stremio we only provide streams.
        // Stremio will automatically call this endpoint with a search query.
        { name: 'stream', types: ['movie', 'series', 'other'], idPrefixes: ['search:'] }
    ],
    catalogs: [] // We provide no catalogs, so we don't show up on the Discover page.
};

// Endpoint to serve the manifest
app.get('/:config?/manifest.json', (req, res) => {
    console.log("Manifest requested with config:", req.params.config);
    res.setHeader('Content-Type', 'application/json');
    res.send(manifest);
});

// --- STREAM ENDPOINT ---
// This is now our ONLY functional endpoint.
// Stremio's search will hit this URL directly. The movie/series ID will contain the search query.
app.get('/:config/stream/:type/:id.json', async (req, res) => {
    const { config, type, id } = req.params;
    
    console.log(`--- Stream Request Received ---`);
    console.log(`Type: ${type}, ID: ${id}`);
    
    // The search query is embedded in the 'id' after the last colon.
    // Example: id = "tt12345:1:1:search=Mia Melano" -> we extract "Mia Melano"
    const searchQuery = id.split(':').pop().replace('search=', '');

    if (!searchQuery) {
        console.log("No search query found in ID. Returning empty streams.");
        return res.json({ streams: [] });
    }

    console.log(`Extracted search query: "${searchQuery}"`);

    try {
        // The StremThru service does all the hard work.
        const stremThruUrl = `https://stremthru.13377001.xyz/${config}/torz/search?query=${encodeURIComponent(searchQuery)}`;
        
        console.log(`Forwarding search to StremThru: ${stremThruUrl}`);

        const response = await fetch(stremThruUrl);
        if (!response.ok) {
            console.error(`StremThru returned an error: ${response.status} ${response.statusText}`);
            throw new Error(`StremThru returned an error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data.streams ? data.streams.length : 0} streams from StremThru.`);

        res.setHeader('Content-Type', 'application/json');
        res.send(data);

    } catch (error) {
        console.error("Error fetching from StremThru:", error);
        res.status(500).json({ streams: [], error: "Could not fetch streams from StremThru." });
    }
});

app.listen(port, () => {
    console.log(`Addon server listening at http://localhost:${port}`);
});
