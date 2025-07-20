const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// This is the configuration for our addon.
const manifest = {
    id: 'com.yourusername.stremthru.search',
    version: '1.0.1', // Incremented version
    name: 'StremThru Search',
    description: 'A simple addon to search for content using StremThru.',
    types: ['movie', 'series'],
    resources: ['catalog', 'stream'],
    catalogs: [
        {
            type: 'movie',
            id: 'stremthru-search', // Simplified ID
            name: 'StremThru Search',
            extra: [{ name: 'search', isRequired: true }] // More robust search declaration
        },
        {
            type: 'series',
            id: 'stremthru-search', // Simplified ID
            name: 'StremThru Search',
            extra: [{ name: 'search', isRequired: true }] // More robust search declaration
        }
    ],
    idPrefixes: ['search:']
};

// Endpoint to serve the manifest
app.get('/:config?/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(manifest);
});

// Catalog endpoint - this is where the search "trick" happens
app.get('/:config/catalog/:type/:id.json', (req, res) => {
    const { type } = req.params;
    const { search } = req.query;

    // ADDED LOGGING
    console.log(`Received catalog request for type: ${type}, search: "${search}"`);

    if (!search) {
        console.log("No search query provided. Returning empty metas.");
        return res.json({ metas: [] });
    }

    // Create a single "meta" object that represents the search action.
    const searchQuery = search;
    const encodedQuery = Buffer.from(searchQuery).toString('base64');
    
    const meta = {
        id: `search:${encodedQuery}`,
        type: type,
        name: `Search results for "${searchQuery}"`,
        poster: "https://raw.githubusercontent.com/g0ldyy/comet/main/comet/templates/comet_icon.png",
        description: `Click to search for streams for "${searchQuery}" on your Debrid service via StremThru.`
    };
    
    console.log("Returning search meta object:", meta);
    res.json({ metas: [meta] });
});

// Stream endpoint - this does the actual work
app.get('/:config/stream/:type/:id.json', async (req, res) => {
    const { config, id } = req.params;

    console.log(`Received stream request for ID: ${id}`);

    if (!id.startsWith('search:')) {
        console.log("ID does not start with 'search:'. Returning empty streams.");
        return res.json({ streams: [] });
    }

    try {
        const encodedQuery = id.substring(7); // Remove "search:" prefix
        const searchQuery = Buffer.from(encodedQuery, 'base64').toString('utf8');

        const stremThruUrl = `https://stremthru.13377001.xyz/${config}/torz/search?query=${encodeURIComponent(searchQuery)}`;
        
        console.log(`Forwarding search to StremThru: ${stremThruUrl}`);

        const response = await fetch(stremThruUrl);
        if (!response.ok) {
            throw new Error(`StremThru returned an error: ${response.status}`);
        }
        
        const streams = await response.json();
        console.log(`Received ${streams.streams ? streams.streams.length : 0} streams from StremThru.`);

        res.setHeader('Content-Type', 'application/json');
        res.send(streams);

    } catch (error) {
        console.error("Error fetching from StremThru:", error);
        res.status(500).json({ streams: [], error: "Could not fetch streams from StremThru." });
    }
});

app.listen(port, () => {
    console.log(`Addon server listening at http://localhost:${port}`);
});
