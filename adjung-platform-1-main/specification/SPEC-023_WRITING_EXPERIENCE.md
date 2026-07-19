# WRITING EXPERIENCE: THE ENTRY-FIRST CANVAS

Document ID: SPEC-023  
Version: 2.0 (Revised)  
Status: Official Specification  
Depends On:  
- SPEC-000 Adjung Constitution  
- SPEC-001 Product Philosophy  
- SPEC-007 Publication Model  
- SPEC-008 Writing Desk  

---

## 1. Purpose

The modern digital writing experience is too often fractured. Traditional CMS editors split the author’s cognitive focus between a raw editing form and a separate "Live Preview" tab. This artificial division forces constant context switching.

Adjung rejects this duality. The Writing Desk is not a separate application layer; it is simply the draft state of the published Entry. Writing and reading should share the exact same canvas and visual style. The draft version of an entry must look and behave like the final published version, changing only its state, not its visual soul.

---

## 2. Design Philosophy

The Entry-First Writing Desk is governed by the following core principles:

1. **The Entry Comes Before the Interface**  
   The primary visual element is the Entry itself (its Title, Body, and Objects). UI controls, buttons, sidebars, and admin widgets must fade into the background, allowing the entry to command absolute focus.

2. **No Live Preview Duality**  
   The separate "Live Preview" or "Rendered View" is eliminated. The editor itself *is* the preview. The editor *is* the Entry. 

3. **Publishing as a State Transition, Not a Visual Transformation**  
   Publishing does not compile or redesign the document. It simply flips a database flag from `Draft` to `Published`. What the author edits is exactly what the reader consumes.

4. **Context-Driven Tools**  
   To preserve calm, uninterrupted writing, toolbars and controls must remain completely invisible until they are explicitly needed.

---

## 3. Entry-First Design

The structural unit of the Writing Desk is the **Entry**, consisting of four primary components:

* **Title**  
  The main display heading, sharing the same classical serif typography and visual hierarchy in both edit and publish states.
* **Body**  
  The continuous, beautifully set text stream where scholarly thoughts are developed.
* **Entry Objects**  
  Rich scholarly elements (e.g., Quotes, Footnotes, Margin Notes) that sit naturally inline or side-by-side with the text, rendered with identical alignment during both draft and publication.
* **Metadata**  
  Administrative attributes (such as tags, categories, language, and visibility) that do not belong on the creative canvas and must not interrupt the reading flow.

---

## 4. Contextual Editing

The Writing Desk does not display permanently visible formatting grids, sidebars, or heavy header bars.

* **No Permanent Formatting Toolbar**  
  The canvas remains pristine and free of fixed text styling grids.
* **Floating Inline Toolbar**  
  When an author highlights text, a lightweight, visually quiet floating toolbar appears immediately above the selection.
* **Typographic Formatting Only**  
  The floating toolbar is strictly limited to basic inline treatments:
  - **Bold**
  - *Italic*
  - <u>Underline</u>
  - [Link](url)
  - "Quote"
* **Exclusion of Complex Objects**  
  Complex blocks, alignments, and scholarly annotations are completely excluded from this contextual formatting menu.

---

## 5. Entry Objects

Advanced structural and scholarly annotations are defined as **Entry Objects**. They are not markdown characters or raw HTML fragments; they are semantic components that insert naturally into the entry flow.

Entry Objects are summoned exclusively via a contextual `+` (Plus) insertion menu or a keyboard command at the block level:

* **Footnote & Endnote** — bottom references linked via superscript anchors.
* **Margin Note** — side annotations vertically aligned with parent paragraphs.
* **Interlining** — secondary linguistic or translation layers stacked above/below words.
* **Quote** — beautifully set block quotations.
* **Images & Tables** — clean, high-fidelity media grids.
* **Code & Formula** — monospaced blocks and inline equations.
* **References** — citations mapped to bibliographical databases.

---

## 6. WYSIWYG Philosophy

The Adjung WYSIWYG philosophy is simple: **The editor is the publication.**

There is no transformation or layout reflow between draft composition and final publication. The visual layout, color palette, leading, typography, and inline objects remain completely intact. The only difference is the presence of quiet editing focus states and metadata panels which are hidden in the read-only view.

---

## 7. Metadata Layer

To protect the visual sanctity of the Entry:

* **Zero Layout Impact**  
  Modifying taxonomy tags, language settings, slugs, visibility, or publication categories must never alter the margins, text layout, or formatting of the Entry.
* **Collapsible Inspectors**  
  All administrative metadata is isolated inside a collapsible side drawer or a slide-out metadata panel. This panel remains closed by default during active drafting.

---

## 8. Mobile Behaviour

On narrow viewports, the Entry remains the central anchor of the screen:

* **Pristine Reading Focus**  
  Margins are gracefully reduced, and the text hierarchy remains clear and legible.
* **Drawer-Based Panels**  
  Collapsible inspector panels slide up as bottom drawers rather than occupying horizontal space.
* **Adaptive Entry Objects**  
  Margin Notes and complex side-annotations collapse dynamically into low-profile badges that expand cleanly on touch, keeping the vertical text column uninhibited.

---

## 9. Accessibility

The elegant simplicity of the Entry-First experience is paired with robust multi-modal interaction:

* **Keyboard-Authoritative Navigation**  
  Every operation, from block insertion to inline formatting, can be fully controlled using keyboard shortcuts.
* **Universal Focus**  
  Focus states are soft, clear, and high-contrast, designed to exceed modern accessibility guidelines without cluttering the aesthetic.

---

## 10. Future Compatibility

The Entry-First model provides a highly stable, extensible foundation. This specification is designed to seamlessly integrate upcoming modules without altering the core Entry schema:

1. **Expanding Entry Objects** — adding support for customized mathematical formulas, tables, and media assets.
2. **Commentary & Annotation Overlays** — registering secondary analytic layers, interlinear linguistic markers, or grammatical callouts.
3. **Paper Clip Systems** — anchoring interactive external reference badges to individual entry blocks.
4. **Digital and Calligraphic Signatures** — rendering verified editorial stamps at the conclusion of published entries.

---

End of Specification.
