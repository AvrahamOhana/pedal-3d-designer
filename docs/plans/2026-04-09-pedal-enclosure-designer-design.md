# Guitar Pedal Enclosure Designer — Design Doc

## Overview

A static web app for designing 3D-printable guitar pedal enclosures. Users select an enclosure size, place component holes on surfaces, and export STL files ready for slicing in Bambu Studio.

**Tech:** Vanilla JS + Three.js + three-bvh-csg, no build step, deployed to GitHub Pages.

## Architecture

Single HTML page with four areas:

- **Toolbar:** presets, export, undo
- **Component Panel (left):** preset selector, component list, properties editor
- **3D Viewport (center):** Three.js scene with OrbitControls
- **Status Bar (bottom):** dimensions, part count

### Files

| File | Purpose |
|------|---------|
| `index.html` | Layout + UI |
| `style.css` | Styling |
| `app.js` | Main app, UI logic, state management |
| `enclosure.js` | Enclosure geometry generation (box + screw bosses + reinforcements) |
| `components.js` | Component definitions (hole sizes, shapes, valid faces) |
| `csg.js` | CSG operations wrapper |
| `exporter.js` | STL export + ZIP bundling |

### Dependencies (CDN)

- Three.js
- three-bvh-csg
- Three.js STLExporter
- Three.js OrbitControls

## Enclosure Model

### Presets (internal dimensions, mm)

| Name | Width | Depth | Height |
|------|-------|-------|--------|
| 1590A | 39 | 89 | 27 |
| 1590B | 60 | 112 | 31 |
| 1590BB | 72 | 120 | 31 |
| 1590XX | 121 | 145 | 34 |
| Custom | user-defined | user-defined | user-defined |

### Two-Piece Construction

- **Bottom half:** open-top box with screw bosses in corners
- **Top half (lid):** flat plate with lip that sits inside the bottom, through-holes in corners
- Wall thickness: 2mm default (adjustable)
- Corner radius: 2mm

### Screw System (Heat-Set Inserts)

**M3 (default):**
- Boss hole: 4.0mm (for brass heat-set insert)
- Boss outer diameter: 8mm
- Hole depth: 5mm
- Lid through-hole: 3.2mm

**M2.5:**
- Boss hole: 3.5mm
- Boss outer diameter: 7mm
- Hole depth: 4.5mm
- Lid through-hole: 2.7mm

User can add additional screw positions along edges for larger enclosures.

## Placeable Components

| Component | Hole Shape | Diameter/Size | Valid Faces |
|-----------|-----------|---------------|-------------|
| Footswitch (3PDT) | Circle | 12mm | Top |
| LED (5mm) | Circle | 5.5mm | Top |
| LED (3mm) | Circle | 3.5mm | Top |
| Toggle switch (SPDT) | Circle | 6.5mm | Top |
| 1/4" Guitar jack | Circle | 9.5mm | Left, Right, Front, Back |
| DC jack (2.1mm barrel) | Circle | 8mm | Left, Right, Front, Back |
| USB-C jack | Rounded rect | 9.5 x 3.5mm | Left, Right, Front, Back |
| Potentiometer | Circle | 7mm | Top |
| M3 screw hole | Circle | 3.2mm | Any |
| M2.5 screw hole | Circle | 2.7mm | Any |

### Footswitch Reinforcement

- Thickened boss ring on inside of top plate: +2mm ring, 8mm beyond hole edge
- 4 radial gusset ribs connecting ring to top plate
- Prevents flex when stomped

## Interaction

1. Click component in side panel to select it
2. Hover over valid face — ghost preview (green, semi-transparent) follows cursor
3. Click to place
4. Click placed component to select — drag to reposition, or edit X/Y numerically in properties panel
5. Delete key or button to remove
6. 0.5mm snap grid (toggleable)

### Viewport

- OrbitControls: drag to rotate, scroll to zoom, right-drag to pan
- Semi-transparent enclosure when placing components
- Placed components: colored rings/outlines on surfaces
- Selected component: blue highlight
- Invalid placement (too close to edge, overlapping): red indicator

## STL Export

- "Export STL" button in toolbar
- Generates ZIP containing:
  - `enclosure-bottom.stl`
  - `enclosure-lid.stl`
- CSG runs at export time: solid halves minus all holes
- Progress indicator during computation

### Print-Ready Considerations

- 0.2mm tolerance on all holes for FDM printing
- Chamfered screw boss tops for lid alignment
- Minimum 1mm wall between any hole and enclosure edge (enforced)
- Optimized for Bambu Lab A1 (standard FDM settings)

## Deployment

- GitHub Pages — static files, no build step
- Push to `main` branch, enable Pages in repo settings
