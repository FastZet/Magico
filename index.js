const express = require('express');
const cors = require('cors'); // <-- ADD THIS LINE
const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // <-- AND ADD THIS LINE

// This is the configuration for our addon.
const manifest = {
    id: 'com.yourusername.stremthru.search',
    version: '1.0.0',
    name: 'StremThru Search',
    description: 'A simple addon to search for content using StremThru.',
    types: ['movie', 'series'],
    resources: ['catalog', 'stream'],
    catalogs: [
        {
            type: 'movie',
            id: 'stremthru-search-movie',
            name: 'StremThru Search',
            extra: { searchSupported: true }
        },
        {
            type: 'series',
            id: 'stremthru-search-series',
            name: 'StremThru Search',
            extra: { searchSupported: true }
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

    if (!search) {
        return res.json({ metas: [] });
    }

    // Create a single "meta" object that represents the search action.
    // Its ID contains the search query, encoded so it can be passed in a URL.
    const searchQuery = search;
    const encodedQuery = Buffer.from(searchQuery).toString('base64');
    
    const meta = {
        id: `search:${encodedQuery}`,
        type: type,
        name: `Search results for "${searchQuery}"`,
        poster: "https://raw.githubusercontent.com/g0ldyy/comet/main/comet/templates/comet_icon.png", // Using Comet's icon for a nice visual
        description: `Click to search for streams for "${searchQuery}" on your Debrid service via StremThru.`
    };

    res.json({ metas: [meta] });
});

// Stream endpoint - this does the actual work
app.get('/:config/stream/:type/:id.json', async (req, res) => {
    const { config, id } = req.params;

    if (!id.startsWith('search:')) {
        return res.json({ streams: [] });
    }

    try {
        const encodedQuery = id.substring(7); // Remove "search:" prefix
        const searchQuery = Buffer.from(encodedQuery, 'base64').toString('utf8');

        // The StremThru service does all the hard work.
        const stremThruUrl = `https://stremthru.13377001.xyz/${config}/torz/search?query=${encodeURIComponent(searchQuery)}`;
        
        console.log(`Forwarding search to StremThru: ${stremThruUrl}`);

        const response = await fetch(stremThruUrl);
        if (!response.ok) {
            throw new Error(`StremThru returned an error: ${response.status}`);
        }
        
        const streams = await response.json();

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
