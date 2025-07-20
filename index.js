const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// This enables CORS, which is crucial for Stremio Web to access your addon.
app.use(cors());

// --- MANIFEST ---
const manifest = {
    id: 'com.yourusername.stremthru.search.final',
    version: '1.3.0', // Incremented version
    name: 'StremThru Search',
    description: 'A direct search addon for Stremio using StremThru.',
    // We will respond to any search type.
    types: ['movie', 'series', 'other'],
    resources: ['catalog', 'stream'],
    // This is the critical fix: We MUST provide a catalog entry for EACH type we support.
    // They all share the same ID to signal they are the same search provider.
    catalogs: [
        {
            type: 'movie',
            id: 'stremthru-search',
            name: 'StremThru Search',
            extra: [{ name: 'search', isRequired: true }]
        },
        {
            type: 'series',
            id: 'stremthru-search',
            name: 'StremThru Search',
            extra: [{ name: 'search', isRequired: true }]
        },
        {
            type: 'other',
            id: 'stremthru-search',
            name: 'StremThru Search',
            extra: [{ name: 'search', isRequired: true }]
        }
    ],
    idPrefixes: ['search:']
};

// A simple root endpoint to confirm the server is running.
app.get('/', (req, res) => {
    res.send('StremThru Search Addon is running!');
});

// Endpoint to serve the manifest.
app.get('/:config?/manifest.json', (req, res) => {
    console.log("--- MANIFEST REQUEST ---");
    console.log("Config:", req.params.config || "None");
    res.setHeader('Content-Type', 'application/json');
    res.send(manifest);
});

// Catalog endpoint. Stremio's search bar calls this.
app.get('/:config/catalog/:type/:id.json', (req, res) => {
    const { type } = req.params;
    const { search } = req.query;

    console.log("--- CATALOG REQUEST ---");
    console.log(`Type: ${type}, Search Query: "${search}"`);

    if (!search) {
        console.log("No search query provided. Responding with empty list.");
        return res.json({ metas: [] });
    }

    const encodedQuery = Buffer.from(search).toString('base64');
    
    const meta = {
        id: `search:${encodedQuery}`,
        type: type,
        name: `Search results for "${search}"`,
        poster: "https://raw.githubusercontent.com/g0ldyy/comet/main/comet/templates/comet_icon.png",
        description: `Click to find streams for "${search}" via StremThru.`
    };

    console.log("Returning fake catalog item:", JSON.stringify(meta, null, 2));
    res.json({ metas: [meta] });
});

// Stream endpoint. Stremio calls this AFTER you click on our fake search result.
app.get('/:config/stream/:type/:id.json', async (req, res) => {
    const { config, type, id } = req.params;

    console.log("--- STREAM REQUEST ---");
    console.log(`Type: ${type}, ID: ${id}`);

    if (!id.startsWith('search:')) {
        console.log("ID is not a search query. Responding with empty streams.");
        return res.json({ streams: [] });
    }

    try {
        const encodedQuery = id.substring(7);
        const searchQuery = Buffer.from(encodedQuery, 'base64').toString('utf8');
        console.log(`Decoded search query: "${searchQuery}"`);

        const stremThruUrl = `https://stremthru.13377001.xyz/${config}/torz/search?query=${encodeURIComponent(searchQuery)}`;
        
        console.log(`Forwarding to StremThru: ${stremThruUrl}`);
        const response = await fetch(stremThruUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`StremThru returned an error: ${response.status}`, errorText);
            throw new Error(`StremThru error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data.streams ? data.streams.length : 0} streams from StremThru.`);
        
        res.setHeader('Content-Type', 'application/json');
        res.send(data);

    } catch (error) {
        console.error("Error in stream endpoint:", error);
        res.status(500).json({ streams: [], error: "An error occurred while fetching streams." });
    }
});

app.listen(port, () => {
    console.log(`Addon server listening at http://localhost:${port}`);
});
