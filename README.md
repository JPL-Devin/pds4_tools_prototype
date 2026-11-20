# PDS4 Viewer

A modern web application for viewing, exploring, and plotting NASA PDS4 data products. Built with FastAPI (Python) and React (TypeScript), styled to NASA's Horizon Design System.

## Features

- **Table Data Viewer**: Display PDS4 table data (Character, Binary, Delimited) with sorting, filtering, and virtual scrolling
- **Interactive Plotting**: Histogram, line, scatter, and heatmap plots with Plotly.js
- **Image Viewer**: 2D image display with colormap controls, brightness/contrast stretching, and RGB composite (coming soon)
- **Label Explorer**: Navigate PDS4 XML label metadata in a tree view
- **NASA HDS Theme**: Dark-themed UI following NASA's Horizon Design System

## Architecture

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+ / FastAPI |
| Frontend | React 18 / TypeScript / Vite |
| Plotting | Plotly.js |
| Styling | Tailwind CSS (NASA HDS tokens) |
| Testing | pytest / Vitest / Playwright |

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies API requests to `http://localhost:8000`.

## Usage

1. Open the app in your browser
2. Upload or select a PDS4 label file (`.xml` or `.lblx`)
3. Browse the data structures described in the label
4. View table data, create plots, or explore images

## Testing

### Backend Tests
```bash
cd backend
pytest -x -q
```

### Frontend Tests
```bash
cd frontend
npm test
```

### E2E Tests
```bash
cd frontend
npx playwright test
```

## License

Apache-2.0. See [LICENSE.md](LICENSE.md).
