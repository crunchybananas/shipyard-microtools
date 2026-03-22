---
name: Figma Import Plan
description: Import Figma files into Atelier via REST API or MCP
---

# Figma Import

## Goal
Import existing Figma designs into Atelier so users can bring their work over
and iterate using AI tools.

## Approach: Figma REST API

### How it works
1. User provides a Figma file URL (e.g., `https://www.figma.com/file/abc123/MyDesign`)
2. User provides a personal access token (from Figma account settings)
3. We call `GET /v1/files/:file_key` to fetch the document tree
4. Walk the node tree and convert each Figma node to an Atelier `DesignElement`
5. Populate the canvas with the converted elements

### Figma Node → Atelier Element Mapping

| Figma Node Type | Atelier Element Type | Notes |
|----------------|---------------------|-------|
| RECTANGLE | rectangle | Direct map. Includes cornerRadius. |
| ELLIPSE | ellipse | Map boundingBox to x/y/width/height |
| LINE | line | Map start/end to x1/y1/x2/y2 |
| TEXT | text | Map characters, fontSize, fontWeight |
| FRAME | frame | Container. Import children recursively. |
| GROUP | frame | Treat as frame with children |
| COMPONENT | frame | Flatten to frame (lose component semantics) |
| INSTANCE | frame | Flatten the rendered instance |
| VECTOR | (skip or path) | Complex paths - skip for MVP |
| BOOLEAN_OPERATION | (skip) | Too complex for MVP |

### Property Mapping

```typescript
function figmaNodeToElement(node: FigmaNode): DesignElement {
  return {
    id: generateId(),
    type: mapNodeType(node.type),
    x: node.absoluteBoundingBox.x,
    y: node.absoluteBoundingBox.y,
    width: node.absoluteBoundingBox.width,
    height: node.absoluteBoundingBox.height,
    rotation: node.rotation ?? 0,
    fill: extractFill(node.fills),        // First solid fill color
    stroke: extractStroke(node.strokes),   // First stroke color
    strokeWidth: node.strokeWeight ?? 0,
    opacity: node.opacity ?? 1,
    cornerRadius: node.cornerRadius ?? 0,
    visible: node.visible !== false,
    locked: node.locked ?? false,
    name: node.name,
    // Text-specific
    text: node.characters,
    fontSize: node.style?.fontSize,
    fontWeight: mapFontWeight(node.style?.fontWeight),
    fontFamily: node.style?.fontFamily,
    textAlign: node.style?.textAlignHorizontal?.toLowerCase(),
  };
}

function extractFill(fills: FigmaPaint[]): string {
  const solid = fills?.find(f => f.type === 'SOLID' && f.visible !== false);
  if (!solid) return 'transparent';
  const { r, g, b } = solid.color;
  return rgbToHex(r, g, b);  // Figma uses 0-1 range
}
```

### Import Flow UX

1. "Import" button in projects home (next to "+ New Project")
2. Opens modal:
   - Figma URL input
   - API token input (with link to "Get your token" → Figma settings)
   - "Remember token" checkbox (stored in localStorage, never sent to our backend)
   - Page/frame selector (after fetching, show top-level frames to pick from)
3. Preview of what will be imported (element count, thumbnail)
4. "Import" creates a new Atelier project with the converted elements

### Limitations (MVP)
- No auto-layout conversion (flattened to absolute positioning)
- No component/variant support (instances flattened)
- No image fills (would need Figma image export API)
- No gradients (use first color stop)
- No effects (shadows, blur) - skip for MVP
- No prototyping links
- Nested frames import as flat list (children get absolute coordinates)

### API Endpoints Needed
- `GET /v1/files/:file_key` - Full document tree
- `GET /v1/files/:file_key/nodes?ids=x` - Specific nodes (for page selection)
- `GET /v1/images/:file_key` - Export node as image (for thumbnails, future)

### CORS Consideration
Figma API allows CORS from any origin, so we can call it directly from the
browser. No backend proxy needed.

## Alternative: Figma MCP

Figma has a Dev Mode MCP server. If the user has Figma desktop app with Dev Mode:
- MCP could extract design tokens (colors, typography, spacing)
- Could get more structured data than REST API
- More complex setup (requires MCP server running)
- Better for design system extraction than file import

**Recommendation:** Start with REST API for file import. MCP can be a future
enhancement for design system sync.

## Alternative: .fig File Parser

Figma's `.fig` format is a proprietary binary format (protobuf-based).
There are community parsers but they're fragile and break on format changes.
Not recommended - use the REST API instead.

## Alternative: Paste from Figma

Figma supports copying nodes to clipboard as SVG. We could:
1. Detect SVG paste on the canvas
2. Parse the SVG
3. Convert SVG elements to DesignElements

This is simpler than API import but less structured. Good as a complementary
feature alongside API import.

## Implementation Order
1. Figma URL parser (extract file key from URL)
2. API client with token auth
3. Node tree walker with type mapping
4. Property converter (fills, strokes, text styles)
5. Import modal UI
6. Page/frame selector
7. SVG paste support (bonus)
