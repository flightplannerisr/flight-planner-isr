const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const helpers = source.slice(
    source.indexOf('        function getPrintPageSize('),
    source.indexOf('        window.captureA3Area =')
);
const context = vm.createContext({});
vm.runInContext(helpers, context);

function near(actual, expected, tolerance = 1e-8) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}

for (const [paper, shortSide, longSide] of [['A4', 210, 297], ['A3', 297, 420]]) {
    for (const landscape of [false, true]) {
        test(`${paper} ${landscape ? 'landscape' : 'portrait'} physical dimensions`, () => {
            const page = context.getPrintPageSize(paper, landscape);
            assert.equal(page.widthMm, landscape ? longSide : shortSide);
            assert.equal(page.heightMm, landscape ? shortSide : longSide);
            near(page.widthPx / 96 * 25.4, page.widthMm);
            near(page.heightPx / 96 * 25.4, page.heightMm);
        });
    }
}

for (const latitude of [0, 29.5, 32, 33.5, 60]) {
    test(`1:250,000 ground scale at latitude ${latitude}`, () => {
        const zoom = context.getFixedScalePrintZoom(latitude);
        const worldPixels = 256 * 2 ** zoom;
        // Independently measure a centered 20 mm segment using the haversine formula.
        const longitudeSpan = 20 * 96 / 25.4 / worldPixels * 2 * Math.PI;
        const hav = Math.cos(latitude * Math.PI / 180) ** 2 *
            Math.sin(longitudeSpan / 2) ** 2;
        const distance = 2 * 6371000 * Math.asin(Math.sqrt(hav));
        near(distance, 5000, 0.001);
        // Rounding zoom to Leaflet's normal quarter steps would change the scale.
        assert.ok(Math.abs(zoom * 4 - Math.round(zoom * 4)) > 0.001);
    });
}

const preview = source.slice(
    source.indexOf('            function previewSize('),
    source.indexOf('            function resizePrimaryRect(')
);

function previewContext(paperSize, fixedScale, zoom, chartPrint = null) {
    const state = vm.createContext({
        paperSize, fixedScale, chartPrint, mapW: 1200, mapH: 800,
        appState: { map: { getZoom: () => zoom } }
    });
    vm.runInContext(helpers + preview, state);
    return state;
}

test('fixed-scale preview tracks paper size, orientation, zoom and page latitude', () => {
    const center = { lat: 32 };
    const a4 = previewContext('A4', true, 11).previewSize(center, false);
    const a3 = previewContext('A3', true, 11).previewSize(center, false);
    near(a3.w / a4.w, 297 / 210);
    near(a3.h / a4.h, 420 / 297);
    const landscape = previewContext('A4', true, 11).previewSize(center, true);
    near(landscape.w, a4.h);
    near(landscape.h, a4.w);
    const zoomed = previewContext('A4', true, 12).previewSize(center, false);
    near(zoomed.w, 2 * a4.w);
    near(zoomed.h, 2 * a4.h);
    const north = previewContext('A4', true, 11).previewSize({ lat: 33.5 }, false);
    near(north.w / a4.w, Math.cos(32 * Math.PI / 180) / Math.cos(33.5 * Math.PI / 180));
});

test('legacy fit selection stays viewport-sized when zoom changes', () => {
    const a = previewContext('A4', false, 11).previewSize({ lat: 32 }, false);
    const b = previewContext('A4', false, 12).previewSize({ lat: 32 }, false);
    near(a.w, b.w);
    near(a.h, b.h);
    near(a.h, 800 * 0.8);
});

function mercatorY(latitude) {
    return Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
}

const sourceMeasurements = {
    'Air Nav Chart': { width: 5712, height: 14575, nm20Pixels: 1166.5, latitude10Pixels: 584.5 },
    'AZM Chart': { width: 8523, height: 22370, nm20Pixels: 1744, latitude10Pixels: 873 }
};

test('active chart geometry uses the visible image layer and its actual bounds', () => {
    const reference = context.CHART_PRINT_REFERENCES['Air Nav Chart'];
    const layer = {
        options: { chartPrintReference: reference },
        getBounds: () => ({
            getNorthWest: () => ({ x: 10, y: 20 }),
            getSouthEast: () => ({ x: 12, y: 25 })
        })
    };
    const map = {
        eachLayer: fn => [{ options: {} }, layer].forEach(fn),
        project: (point, zoom) => {
            assert.equal(zoom, 0);
            return point;
        }
    };
    const actual = context.getActiveChartPrintView(map);
    const expected = context.getChartPrintGeometry(reference, 2, 5);
    assert.equal(actual.layer, layer);
    assert.equal(actual.reference, reference);
    near(actual.zoom, expected.zoom);
    near(actual.verticalStretch, expected.verticalStretch);
});

test('street layers do not enable chart correction', () => {
    const map = { eachLayer: fn => [{ options: {} }, {}].forEach(fn) };
    assert.equal(context.getActiveChartPrintView(map), null);
});

for (const [mapName, measured] of Object.entries(sourceMeasurements)) {
    const reference = context.CHART_PRINT_REFERENCES[mapName];
    for (const margins of [false, true]) {
        const latSpan = 33.333333 - 29.5;
        const west = 34.166667 - (margins ? 1.666666 * 0.0145 : 0);
        const east = 35.833333 + (margins ? 1.666666 * 0.0145 : 0);
        const south = 29.5 - (margins ? latSpan * 0.021 : 0);
        const north = 33.333333 + (margins ? latSpan * 0.030 : 0);
        const projectedWidth = (east - west) / 360 * 256;
        const projectedHeight = (mercatorY(north) - mercatorY(south)) / (2 * Math.PI) * 256;
        const geometry = context.getChartPrintGeometry(reference, projectedWidth, projectedHeight);
        const worldScale = 2 ** geometry.zoom;
        const sourcePixelWidth = projectedWidth * worldScale / measured.width;
        const sourcePixelHeight = projectedHeight * worldScale * geometry.verticalStretch / measured.height;

        test(`${mapName} ${margins ? 'expanded' : 'standard'} bounds: original 20 NM bar is 148.16 mm`, () => {
            const barWidth = sourcePixelWidth * measured.nm20Pixels;
            near(barWidth / 96 * 25.4, 148.16);
            const gridHeight = sourcePixelHeight * measured.latitude10Pixels;
            near(gridHeight / 96 * 25.4, 74.08);
        });

        for (const paper of ['A4', 'A3']) {
            for (const landscape of [false, true]) {
                test(`${mapName} ${paper} ${landscape ? 'landscape' : 'portrait'} preview matches both printed axes`, () => {
                    const zoom = 11;
                    const size = previewContext(paper, true, zoom, geometry)
                        .previewSize({ lat: 32 }, landscape);
                    const page = context.getPrintPageSize(paper, landscape);
                    // Project the selected region through the print-only CRS.
                    near(size.w * 2 ** (geometry.zoom - zoom), page.widthPx);
                    near(size.h * 2 ** (geometry.zoom - zoom) * geometry.verticalStretch, page.heightPx);
                    const moved = previewContext(paper, true, zoom, geometry)
                        .previewSize({ lat: 33.2 }, landscape);
                    near(moved.w, size.w);
                    near(moved.h, size.h);
                });
            }
        }
    }

    test(`${mapName} fit selection does not apply chart correction`, () => {
        const geometry = { zoom: 11.5, verticalStretch: 0.85 };
        const chart = previewContext('A4', false, 11, geometry).previewSize({ lat: 32 }, false);
        const street = previewContext('A4', false, 11).previewSize({ lat: 32 }, false);
        near(chart.w, street.w);
        near(chart.h, street.h);
    });
}
