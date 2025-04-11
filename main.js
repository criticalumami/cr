// Initialize map
const map = L.map('map', { 
    attributionControl: false,
    zoomControl: true
});

// Define basemaps
const minimalistBasemap = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

const satelliteBasemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19
});

const whiteBasemap = L.tileLayer('', {
    maxZoom: 19
});

const baseMaps = {
    "Minimalist": minimalistBasemap,
    "Satellite": satelliteBasemap,
    "White": whiteBasemap
};

// Add map title
const mapTitle = L.control({position: 'topright'});
mapTitle.onAdd = function() {
    const div = L.DomUtil.create('div', 'map-title');
    div.innerHTML = 'Cola Roundabout - S07';
    return div;
};
mapTitle.addTo(map);

// Add scale bar
L.control.scale({
    maxWidth: 200,
    metric: true,
    imperial: false,
    position: 'bottomleft'
}).addTo(map);

// Add north arrow
const northArrow = L.control({ position: 'bottomright' });
northArrow.onAdd = function() {
    const div = L.DomUtil.create('div', 'north-arrow');
    div.innerHTML = '<img src="icons/north-arrow.svg" alt="North Arrow">';
    return div;
};
northArrow.addTo(map);

// Add layer control
const layerControl = L.control.layers(baseMaps, {}, { position: 'bottomright' }).addTo(map);

// Add CR boundary and inverted mask
fetch('data/CR.geojson')
    .then(response => response.json())
    .then(data => {
        const feature = data.features[0];
        
        if (feature.geometry.type === 'Polygon') {
            // Define coordinates for the world bounds
            const outerBounds = [
                [-90, -180],
                [-90, 180],
                [90, 180],
                [90, -180],
                [-90, -180]
            ];
            
            // Get the coordinates for the inner hole (CR boundary)
            const innerHole = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]); // Swap lon/lat for Leaflet
            
            // Combine outer bounds and inner hole for the mask polygon
            const maskCoords = [outerBounds, innerHole];
            
            // Create and add the mask layer (inverted polygon)
            L.polygon(maskCoords, {
                color: 'white',      // Mask color
                fillColor: 'white',
                fillOpacity: 0.7,    // Fully opaque mask
                stroke: false,       // No border for the mask itself
                interactive: false   // Mask should not be interactive
            }).addTo(map);
            
            // Add the boundary line separately for visual reference
            const boundaryLayer = L.geoJSON(feature, {
                style: {
                    color: 'black',    // Boundary line color
                    weight: 2,         // Boundary line width
                    fill: false,       // No fill for the boundary line itself
                    fillOpacity: 0     // Ensure no fill opacity
                }
            }).addTo(map);
            
            // Fit the map to the CR boundary
            map.fitBounds(boundaryLayer.getBounds());
        }
    });

// Add buildings layer to the layer control
fetch('data/buildings.geojson')
    .then(response => response.json())
    .then(data => {
        const buildingsLayer = L.geoJSON(data, {
            className: 'buildings-layer'
        });
        buildingsLayer.addTo(map);
        layerControl.addOverlay(buildingsLayer, 'Buildings');
    });

// Add landmarks layer to the layer control
fetch('data/leaf_landmarks.geojson')
    .then(response => response.json())
    .then(data => {
        const landmarkIcon = L.icon({
            iconUrl: 'icons/loz.svg',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const landmarksLayer = L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                const marker = L.marker(latlng, { icon: landmarkIcon });
                marker.bindTooltip(feature.properties.Name, {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -12],
                    className: 'landmark-tooltip'
                });
                return marker;
            }
        });
        landmarksLayer.addTo(map);
        layerControl.addOverlay(landmarksLayer, 'Landmarks');
    });

// Add survey lines layer to the layer control
fetch('data/surv.geojson')
    .then(response => response.json())
    .then(data => {
        const surveyLinesLayer = L.geoJSON(data, {
            style: {
                color: '#cccccc',
                weight: 1
            }
        });
        surveyLinesLayer.addTo(map);
        layerControl.addOverlay(surveyLinesLayer, 'Survey Lines');
    });

// Add parks layer to the layer control
fetch('data/parks_filtered.geojson')
    .then(response => response.json())
    .then(data => {
        const parksLayer = L.geoJSON(data, {
            style: {
                color: 'darkgreen',
                fillColor: 'lightgreen',
                fillOpacity: 0.5,
                weight: 1
            }
        });
        parksLayer.addTo(map);
        layerControl.addOverlay(parksLayer, 'Parks');
    });

// Add photos layer to the layer control
fetch('data/photos.geojson')
    .then(response => response.json())
    .then(data => {
        const photoIcon = L.icon({
            iconUrl: 'icons/photo.svg',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const photosLayer = L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                const marker = L.marker(latlng, { 
                    icon: photoIcon,
                    rotationAngle: feature.properties.direction || 0 
                });
                
                const tooltipContent = `
                    <div>
                        <img src="photos/${feature.properties.filename}.JPG" class="photo-thumbnail" alt="${feature.properties.Name}"/>
                        <div>${feature.properties.filename}</div>
                    </div>
                `;
                
                marker.bindTooltip(tooltipContent, {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -12],
                    className: 'photo-tooltip'
                });
                return marker;
            }
        });
        photosLayer.addTo(map);
        layerControl.addOverlay(photosLayer, 'Photos');
    });

// Add CR nodes layer
fetch('data/nodes.geojson')
    .then(response => response.json())
    .then(data => {
        // Filter only nodes that start with CR
        const crNodes = {
            type: "FeatureCollection",
            features: data.features.filter(f => f.properties.Name && f.properties.Name.startsWith('CR'))
        };

        const crNodesLayer = L.geoJSON(crNodes, {
            pointToLayer: function(feature, latlng) {
                const circleMarker = L.circleMarker(latlng, {
                    radius: 12,           // Increased from 8 to 12
                    fillColor: '#FFFFFF',
                    color: '#000000',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 1,
                    zIndexOffset: 1000    // Ensure markers appear on top
                });

                // Add permanent label
                circleMarker.bindTooltip(feature.properties.Name, {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -12],
                    className: 'cr-node-label',
                    zIndexOffset: 1000    // Ensure labels appear on top
                });

                return circleMarker;
            }
        });
        crNodesLayer.addTo(map);
        layerControl.addOverlay(crNodesLayer, 'CR Nodes');
    });

// Add detailed zones layer to the layer control
fetch('data/det.geojson')
    .then(response => response.json())
    .then(data => {
        const detLayer = L.geoJSON(data, {
            style: {
                color: '#FFA500',
                fillColor: '#FFE4B5',
                fillOpacity: 0.6,
                weight: 2
            },
            onEachFeature: function(feature, layer) {
                if (feature.properties.name) {
                    const bounds = layer.getBounds();
                    const west = bounds.getWest();
                    const width = bounds.getEast() - west;
                    const labelPoint = L.latLng(bounds.getCenter().lat, west - width * 0.5);
                    
                    // Create a point marker for the label
                    const labelMarker = L.marker(labelPoint, {
                        icon: L.divIcon({
                            className: 'det-zone-label',
                            html: feature.properties.name,
                            iconAnchor: [0, 12] // Adjust vertical position
                        })
                    });
                    
                    // Add the label marker to the same layer group
                    labelMarker.addTo(map);
                }
                
                if (feature.properties.url) {
                    layer.on('click', () => window.open(`pdf/${feature.properties.url}`, '_blank'));
                    layer.on('mouseover', function() {
                        layer.setStyle({ fillOpacity: 0.8 });
                        layer._path.style.cursor = 'pointer';
                    });
                    layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.6 }));
                }
            }
        });
        detLayer.addTo(map);
        layerControl.addOverlay(detLayer, 'Detail Zones');
    });