# WRITING ARCHITECTURE: THE ENTRY BLUEPRINT

Document ID: SPEC-024  
Version: 2.0 (Revised)  
Status: Official Engineering Architecture  
Depends On:  
- SPEC-000 Adjung Constitution  
- SPEC-001 Product Philosophy  
- SPEC-008 Writing Desk  
- SPEC-023 Writing Experience  

---

## 1. Overall System Architecture

The software architecture of the Adjung Writing Desk coordinates the life cycle of an entry as a structured, state-driven model. Rather than managing unstructured text fields, the system coordinates actions through five main subsystems:

```
Writing Desk (State & Input Controller)
         │
         ▼
  Document Model (Hierarchical Semantic Blocks)
         │
         ▼
 Annotation Engine (Modular Reference & Margin Offsets)
         │
         ▼
  Rendering Engine (Unified Edit / Publish Visual Compiler)
         │
         ▼
 Publication Engine (State Transitions & Database Sync)
```

### Subsystem Responsibilities

1. **Writing Desk (Controller)**: Handles raw input events, keyboard shortcuts, text selection tracking, and event synchronization.
2. **Document Model**: Houses the document state as a strictly defined tree of semantic blocks, completely decoupled from styling or HTML code.
3. **Annotation Engine**: Registers, indexes, and calculates layout attachments for side and bottom annotations (footnotes, margin notes).
4. **Rendering Engine**: Renders blocks into interactive elements (Edit Mode) or static text (Read Mode), sharing identical styles.
5. **Publication Engine**: Manages saving states, versioning history, and changing entry visibility flags.

---

## 2. Document Model

The Entry Document Model rejects unstructured plain-text strings, HTML blobs, or messy Markdown parsing in favor of a clean, structured JSON Abstract Syntax Tree (AST).

### Model AST Specification

```json
{
  "id": "entry-unique-uuid",
  "version": 1,
  "blocks": [
    {
      "id": "blk-92f1",
      "type": "paragraph",
      "text": "The Editorial Scriptorium offers a quiet harbor for the preservation of complex ideas.",
      "inlineFormatting": [
        { "offset": 4, "length": 9, "type": "italic" }
      ]
    },
    {
      "id": "blk-12a4",
      "type": "footnote-citation",
      "text": "[1]",
      "citationId": "cite-001"
    }
  ]
}
```

### Why Semantic Blocks are Mandatory

* **Precision Rendering**: Since components like Margin Notes align beside specific text blocks, each block must have a persistent, database-stable ID.
* **Corrupt-Free Styling**: Authors cannot write syntactically incomplete HTML or unclosed Markdown tags. Formatting ranges are kept as numeric offsets, ensuring high-fidelity rendering.
* **Extensible Schema**: The block-based structure allows developers to introduce new complex objects (such as formula charts or callout blocks) without modifying any existing paragraphs.

---

## 3. Rendering Engine

The **Rendering Engine** handles the compile-to-view step of the Entry:

```
┌─────────────────┐
│  Document AST   │ ──► Parsed JSON Block List
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Semantic Blocks │ ──► Map block.type to target React nodes
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Visual Layout   │ ──► Merges Annotation coordinates & styles
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Unified Canvas  │ ──► Identical look in Edit Mode & Read Mode
└─────────────────┘
```

### The Shared Renderer Concept

The Editor and the Published view must consume the exact same rendering modules and CSS structures. 
- In **Edit Mode**, paragraph blocks are rendered with quiet edit boundaries, inline caret trackers, and focus rings.
- In **Read Mode**, the same parser renders identical spacing, fonts, margins, and layout, but swaps the inputs for static paragraphs.

Publishing the Entry requires zero conversion or stylesheet swapping.

---

## 4. Annotation Engine

Annotations and secondary commentary layers are completely modular, separated from the primary paragraph text stream.

### Engine Services

* **Dynamic Footnote Map**: Collects and sorts footnote blocks. It generates numerical superscript indexes dynamically so authors do not have to number them manually.
* **Asynchronous Margin Notes**: Calculates vertical positions next to their parent paragraph anchors, aligning commentary with its context on wide screens.
* **Commentary & Annotation Layers**: Manages phonetic annotations (e.g., Arabic I'rab or classical interlineations) aligned precisely above or below corresponding text tokens.

### Modularity

By keeping annotations modular, adding a new annotation layer (e.g., an inline glossary tag) never requires modifications to the core paragraph schemas.

---

## 5. Object Insertion & Command Model

Adding complex Entry Objects (Quotes, Tables, Formulas, Footnotes) uses a strict transaction command chain.

### Insertion Pipeline

```
Context Trigger (Keyboard shortcut or block "+" icon click)
         │
         ▼
Unified Object Inserter (Contextual Floating Popup)
         │
         ▼
Select Object Type (e.g., "Insert Footnote")
         │
         ▼
Focussed Object Editor (Dedicated overlay, avoiding inline markup editing)
         │
         ▼
Transaction Dispatched (Appends structured block to Document AST)
```

No scholarly object allows authors to type raw formatting tags inside a paragraph. Every asset, footnote, and table is created clean and intact.

---

## 6. Floating Toolbar Architecture

The floating toolbar provides fast, distraction-free typography controls without occupying permanent screen space.

### Architecture Rules

* **Visibility**: Appears only on active text selection where character selection size $L > 0$.
* **Dismissal**: Closes immediately on caret movement, clicking outside, or pressing `Escape`.
* **Controls**: Limited strictly to inline text traits:
  - Weight (`Bold`)
  - Style (`Italic`)
  - Decoration (`Underline`)
  - Links (`URL Anchor`)
* **Layout Isolation**: Positioned contextually using floating viewport coordinators (e.g., Floating UI) without causing layout reflows in the main document.

---

## 7. Metadata Layer

Administrative metadata is entirely separated from the creative rendering tree.

* Modifying categories, public visibility states, or search terms updates the metadata object inside the database, but never triggers canvas or paragraph re-renders.
* Inputs are presented in secondary slide-out inspector panels that remain hidden during active composition.

---

## 8. Mobile Architecture

On smaller devices, the mobile layout relies on a single vertical scroll:

* **Centrality**: The primary column of text retains full priority.
* **Drawers**: Panels (e.g., formatting help, revision history, and metadata editors) slide up as bottom drawers to keep the keyboard area clean.
* **Adaptive Side Notes**: Margin notes gracefully compress into inline markers. Selecting an inline marker opens the margin commentary in a transient slide-up panel.

---

## 9. Extension Points

The Writing Desk architecture exposes clean hook registries for future integrations:

* **Signature Engine**: Appends cryptographic editorial sign-offs to published records.
* **Paper Clip & Bookmarks**: Pins external documents or references to individual blocks.
* **Linguistic & AI Layers**: Passes block text to analyzing servers (e.g., grammar parsers, translations) without altering the parent document schema.

---

End of Specification.
