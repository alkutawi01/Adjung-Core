# SAINS UNTUK SEMUA
## Single Source of Truth (SSOT) v2.0 — Keputusan LOCK Sesi 1–10 (MASTER BLUEPRINT)

**Pemilik/Penerbit:** Adjung Press
**Status dokumen:** Muktamad bagi keputusan Sesi 1–10 — MASTER BLUEPRINT SESSIONS 1–10: FINAL LOCKED & CLOSED
**Tarikh:** 11 September 2026
**Tujuan:** Dokumen rujukan tunggal sebelum Fasa 0 pembangunan. Dokumen ini hanya mengandungi keputusan yang benar-benar telah dipersetujui/LOCK. Perkara yang belum diputuskan tidak dinaikkan menjadi dasar secara senyap.

> Izzat sudah boleh memulakan Fasa 0 coding sepenuhnya sekarang. Tiada lagi sesi perancangan utama yang perlu ditunggu. Default kerja kini bertukar daripada "Apa lagi yang perlu kita rancang?" kepada "Apa perkara paling kecil yang boleh kita bina sekarang untuk menguji keputusan yang sudah kita buat?"

---

## 0. Prinsip induk projek

Sains untuk Semua ialah ensiklopedia digital sains berbahasa Melayu untuk masyarakat umum. Ia bukan buku teks sekolah yang dipindahkan ke web, bukan portal berita sains, bukan LMS, dan bukan koleksi artikel AI berskala besar tanpa kawalan editorial.

**Falsafah produk:**

> Ensiklopedia yang membuat sesiapa pun ingin tahu seperti seorang kanak-kanak — tanpa menulis kepada mereka seperti kanak-kanak.

Ia dibina berdasarkan prinsip:

- **Low floor, high ceiling.** Pembaca yang tidak mempunyai latar belakang sains mesti boleh masuk, tetapi artikel tidak boleh menjadi terlalu cetek sehingga pembaca yang lebih berpengetahuan tidak mendapat apa-apa.
- **Design Reference Reader** sekitar umur 13–14 tahun digunakan sebagai alat mengkalibrasi kebolehbacaan, bukan definisi audiens.

Prinsip tambahan yang merentasi sistem:

- One concept = one canonical entry.
- Evergreen first.
- Text first, visual purposeful.
- The article is the interface.
- Calm authority, not educational decoration.
- The layout adapts to the knowledge; the knowledge must never be padded to satisfy the layout.

---

## SESI 1 — PRODUCT DEFINITION & POSITIONING
**STATUS: LOCKED**

### 1.1 Identiti produk
Sains untuk Semua ialah penerbitan ilmu sains digital BM yang:
- ditujukan kepada masyarakat umum;
- mempunyai kedalaman progresif;
- berorientasikan rasa ingin tahu;
- mengutamakan artikel canonical long-form;
- menggabungkan konsep, sejarah, konteks dan epistemologi;
- mempunyai knowledge graph;
- menggunakan visual apabila visual benar-benar membantu pemahaman;
- dibina sebagai penerbitan evergreen.

Ia bukan "ensiklopedia kanak-kanak". Ia juga tidak perlu berbunyi seperti buku teks atau jurnal akademik.

### 1.2 Coverage philosophy
Kurikulum KPM menjadi salah satu tulang belakang liputan awal kerana ia memberikan baseline ilmu yang berguna. Tetapi:

> KPM is the coverage backbone, not the content ceiling.

Portal boleh pergi lebih luas dan lebih dalam daripada silibus apabila konsep memerlukannya.

### 1.3 Context is knowledge
Artikel tidak hanya menjawab *apa*. Apabila relevan, ia juga menerangkan: mengapa sesuatu persoalan muncul; bagaimana idea berkembang; masalah yang cuba diselesaikan; bukti yang membawa kepada pemahaman semasa; manusia/tradisi yang terlibat; had model; perkara yang masih tidak diketahui.

### 1.4 "Bagaimana Kita Tahu?"
Ini menjadi salah satu identiti editorial utama Sains untuk Semua. Sains tidak dipersembahkan sebagai himpunan fakta yang jatuh dari langit. Pembaca perlu, apabila sesuai, dapat melihat hubungan:

> pemerhatian → bukti → inferens → model → batasan

### 1.5 Struktur penerbitan masa depan
Sains untuk Semua boleh menjadi sebahagian keluarga portal Adjung seperti: Sains; Matematik; Pengaturcaraan; Komputer; Linguistik; dengan kemungkinan umbrella portal pada masa hadapan. Keputusan nama/domain portal lain belum LOCK.

Prinsip yang telah dipilih ialah berkongsi sebanyak mungkin: codebase; CMS; database; sistem editorial; sambil membenarkan setiap portal mempunyai mini-homepage dan aksen visual yang terkawal.

### 1.6 Urutan pengembangan
Mulakan dengan Sains. Matematik boleh menyusul selepas kira-kira 50–100 artikel sains yang benar-benar kuat, kerana Sains lebih sesuai untuk menguji formula editorial terlebih dahulu sementara Matematik memerlukan tambahan notation, graph, formula dan step-by-step rendering.

---

## SESI 2 — SCOPE, TAXONOMY & CANONICAL KNOWLEDGE STRUCTURE
**STATUS: LOCKED**

### 2.1 Struktur pengetahuan backend
Hierarki asas: **Domain → Subdomain → Concept Cluster → Canonical Entry**

Ini ialah struktur organisasi corpus, bukan semestinya struktur navigasi yang dipaparkan secara literal kepada pembaca.

### 2.2 Sembilan pintu pembaca
Frontend Science mempunyai sembilan pintu utama:
1. Alam Semesta
2. Bumi
3. Hidupan
4. Tubuh Manusia
5. Bahan & Jirim
6. Tenaga & Daya
7. Cahaya, Bunyi & Gelombang
8. Cuaca & Alam Sekitar
9. Cara Sains Mengetahui

Ini ialah reader-facing browse doors, bukan pendedahan mentah taxonomy backend.

### 2.3 Sempadan disiplin
Bidang utama: Fizik; Kimia; Biologi; Astronomi; Sains Bumi.

Bidang seperti Geologi; Meteorologi; Oseanografi — berada di bawah keluarga Sains Bumi.

Bidang seperti Ekologi; Neurosains; Genetik; Evolusi; Mikrobiologi; Botani; Zoologi; Anatomi & Fisiologi — ditempatkan dalam struktur biologi/tubuh mengikut konsep.

Bidang silang termasuk: Environmental Science; Materials Science; Planetary Science.

History of Science ialah cross-layer, bukan domain terasing yang memutuskan sejarah daripada konsep.

Clinical medicine, diagnosis dan treatment berada di luar skop utama. Namun pengetahuan asas seperti fisiologi; imuniti; mekanisme penyakit — boleh diterangkan sebagai sains.

### 2.4 Canonicality
Prinsip: **One concept = one canonical entry.**

Satu konsep mempunyai: satu `canonical_entry_id`; satu `primary_taxonomy_location`; satu `canonical_owner`.

Kategori, collection, Journey dan graph relationship menunjuk kepada entry yang sama. Jangan mencipta versi seperti `/atom`, `/kimia/atom`, `/bahan/atom` sebagai tiga artikel berasingan untuk konsep yang sama.

### 2.5 Canonical Entry Test
Sesuatu konsep layak berdiri sebagai Canonical Entry jika memenuhi sekurang-kurangnya 3 daripada 5 kriteria:
1. mempunyai definisi standalone;
2. merupakan perkara yang munasabah dicari secara langsung;
3. mampu menyokong kira-kira 500–800 patah perkataan bermakna;
4. mempunyai hubungan penting dengan konsep lain;
5. mempunyai nilai penjelasan bebas.

Ini ialah editorial test, bukan sasaran panjang mekanikal.

### 2.6 Relationship vocabulary awal
Antara hubungan yang telah ditetapkan: `prerequisite`, `part_of`, `causes`, `produced_by`, `measured_by`, `used_in`, `historically_related`, `often_confused_with`, `evidence_for`, `application_of`. Serta hubungan hierarki seperti `broader`, `narrower`.

Relationship vocabulary boleh berkembang secara terkawal apabila fungsi semantik sebenar memerlukannya.

### 2.7 Metadata penting
Antara metadata konsep: `curriculum_status`, `kpm_level`, `kpm_year`, `kpm_reference`, `prerequisites`, `related_concepts`, `broader`, `narrower`, `concept_difficulty`, `concept_maturity`, `source_status`, `canonical_owner`.

### 2.8 Sasaran skala
Panduan skala corpus: 100 — MVP/testbed; 500 — mula benar-benar berguna; 1,500–2,500 — foundational encyclopedia yang matang; 5,000+ — corpus besar.

Elakkan strategi menghasilkan 20,000 artikel nipis dengan AI.

Sebanyak 100 starter concepts telah dirancang merentasi: Matter; Energy/Force; Light/Sound/Waves; Life; Human Body; Earth; Universe.

---

## SESI 3 — EDITORIAL GRAMMAR & ARTICLE ANATOMY
**STATUS: LOCKED**

### 3.1 Struktur asas
Canonical Entry secara konseptual mengikuti: **Title → Opening → Narrative Explanation → Closure → Knowledge Graph Continuation**

Bahagian seperti "Ringkasnya", "Dalami", "Masih Menjadi Persoalan" adalah optional, bukan checkbox template.

### 3.2 Progressive Depth
Artikel bermula daripada sesuatu yang boleh dimasuki pembaca umum dan secara beransur-ansur meningkatkan kedalaman. Tidak perlu memecah kandungan kepada Beginner/Intermediate/Advanced. Kedalaman berlaku melalui penulisan.

### 3.3 Contextual Terminology
Istilah teknikal tidak diperkenalkan sebelum pembaca mempunyai konteks yang cukup untuk memahaminya. Terminologi melayani penerangan; penerangan bukan alasan untuk mempamerkan terminologi.

### 3.4 Curiosity-driven opening
Opening perlu menimbulkan persoalan sebenar atau membawa pembaca masuk kepada masalah. Elakkan formula generik ("Tahukah anda...?") dan clickbait.

### 3.5 Subheading sebagai thought navigator
Subheading bukan label silibus semata-mata. Ia membantu pembaca mengikuti perkembangan pemikiran.

### 3.6 Lima archetype editorial
Sekurang-kurangnya lima bentuk artikel boleh digunakan: Concept; Process; Discovery; Scale Journey; Counterintuitive. Ini bukan lima template UI.

### 3.7 Context Is Part of Knowledge
Sejarah, sebab sesuatu persoalan timbul dan perkembangan model boleh menjadi sebahagian penjelasan apabila ia meningkatkan pemahaman.

### 3.8 "Bagaimana Kita Tahu?"
Ini signature epistemic element portal. Ia perlu menunjukkan bagaimana manusia mempunyai alasan untuk menerima sesuatu pengetahuan, bukan hanya menyatakan "saintis mendapati".

### 3.9 Visual-Purposeful
Visual digunakan apabila ia meningkatkan pemahaman. Artikel biasa mungkin mempunyai 0–2 visual, tetapi ini bukan quota.

### 3.10 No False Simplicity
Kebolehfahaman tidak menghalalkan fakta salah. Antara pembetulan contoh yang telah dijadikan guardrail:
- atom: unit terkecil sesuatu unsur yang masih mengekalkan identiti kimia unsur tersebut;
- fotosintesis: cahaya membekalkan tenaga, manakala karbon bahan organik berasal daripada CO₂;
- graviti Newtonian dan General Relativity perlu dipisahkan secara progresif;
- sejarah sains tidak ditulis sebagai Great Man History semata-mata.

### 3.11 Source provenance
Material factual claims mesti boleh dijejaki kepada evidence di backend. Frontend tidak perlu mengganggu pembacaan dengan citation clutter.

---

## SESI 4 — LANGUAGE, HOUSE STYLE & TAUHID EDITORIAL PHILOSOPHY
**STATUS: LOCKED**

### 4.1 Suara bahasa
Suara yang dikehendaki: knowledgeable; calm; intelligent popular science; natural BM; accessible tanpa childishness; tidak berbunyi seperti terjemahan langsung bahasa Inggeris. Bukan default "scholarly prose" berat.

### 4.2 Rhythm
Ayat boleh pendek atau panjang mengikut fungsi. Tiada had mekanikal bilangan perkataan setiap ayat. Rhetorical question digunakan apabila benar-benar membantu.

### 4.3 Analogy Safety Test
Analogi ialah alat pemahaman, bukan realiti literal. Jika analogi boleh membina model mental salah, batas analogi perlu diterangkan.

### 4.4 Terminologi
Keutamaan ialah istilah BM yang tepat dan natural. Istilah asal boleh diberikan apabila membantu precision atau recognition. Sistem tidak memaksa formula mekanikal "setiap istilah mesti BM + English dalam kurungan".

### 4.5 Formula
Formulas earn their place. Formula hadir apabila membawa pemahaman tambahan dan diterangkan dalam konteks.

### 4.6 Ketidakpastian saintifik
Bahasa mesti membezakan tahap kepastian seperti: menunjukkan; menyokong; mencadangkan; konsisten dengan; belum diketahui; masih diperdebatkan — dan tidak menaikkan tahap evidence secara retorik.

### 4.7 AI style blacklist
Penulisan perlu mengelakkan corak AI yang mekanikal, repetitif, terlalu simetri atau penuh frasa kosong. Penggunaan "kamu", "kita", dan rhetorical intimacy tidak boleh berlebihan. Terutama elakkan epistemic overreach seperti "Kini kita tahu dengan pasti..." apabila evidence tidak membenarkannya.

### 4.8 Tauhid
Prinsip utama: **Tauhid is architectural, explicit Islam is contextual.**

Dalam BM: Tauhid membentuk seni bina pandangan ilmu; unsur Islam yang eksplisit muncul apabila konteks benar-benar memerlukannya.

> Tauhid hadir sebagai lensa, bukan pelekat.

Protective rule: Tidak memasukkan unsur Islam apabila ia tidak diperlukan bukan sekularisme. Memasukkannya tanpa fungsi pula bukan integrasi.

### 4.9 Tiga lapisan epistemik
- **Lapisan 1** — empirical natural facts: Apa yang dapat dikaji melalui kaedah empirikal.
- **Lapisan 2** — epistemology of science: Bagaimana observation, measurement, inference, testing dan model digunakan.
- **Lapisan 3** — Tauhid/Islam apabila relevan: Termasuk alam sebagai ayat Allah, adab/kerendahan epistemik, sejarah sarjana Muslim, dan wahyu apabila konteks benar-benar memerlukannya.

Elakkan slogan simplistik: "Science answers how; religion answers why."

### 4.10 Anti-forced-concordism
Tidak menggunakan Quran sebagai "bukti saintifik" melalui padanan longgar. Elakkan dakwaan seperti "Quran telah membuktikan Big Bang 1,400 tahun dahulu." Hubungan boleh dibincangkan dengan attribution dan tahap dakwaan yang tepat.

### 4.11 Sumber Islam
- dakwaan agama memerlukan sumber Islam;
- dakwaan sains memerlukan sumber sains;
- satu jenis sumber tidak melakukan kerja epistemik jenis sumber lain.

Hadith memerlukan provenance seperti takhrij/status apabila digunakan. Tafsir mesti dirujuk kepada tradisi/sumber yang dikenali. AI tidak dibenarkan mencipta tafsiran Quran sendiri untuk menyesuaikannya dengan sains. Human evolution disimpan untuk dedicated editorial/Syariah review.

---

## SESI 5 — SOURCES, PROVENANCE & FACT-CHECKING
**STATUS: LOCKED**

### 5.1 Zero Unsupported Material Claims
Prinsip yang dipilih ialah **Zero Unsupported Material Claims Rule** — bukan "zero unchecked claims" secara literal. Semua material factual claims yang memberi kesan kepada pemahaman mesti mempunyai evidence yang sesuai.

### 5.2 Source Fitness by Claim Type
Prestij sumber sahaja tidak menentukan kesesuaian. Soalan utama: Adakah jenis sumber ini sesuai untuk jenis dakwaan ini?

### 5.3 Three-Lane Source Architecture
- **Lane 1 — Scientific Claims**: Untuk dakwaan saintifik.
- **Lane 2 — Islamic Claims**: Untuk Quran, hadith, tafsir, fiqh, aqidah atau dakwaan agama lain.
- **Lane 3 — Historical / Philosophical / Editorial Claims**: Untuk sejarah, historiografi, falsafah, biografi dan contextual claims.

### 5.4 Source Must Truly Entail Claim
Sumber yang menyebut topik sama belum tentu menyokong dakwaan. Evidence mesti benar-benar membawa kepada claim yang dipetakan kepadanya.

### 5.5 Historiography & Anachronism QA
Sistem perlu mengesan naratif yang menggabungkan fakta benar daripada zaman atau kerangka berbeza lalu menghasilkan sejarah palsu. Ini penting khususnya dalam sejarah sains; sejarah Islam; perkembangan istilah; atribusi discovery.

### 5.6 Tafsir/Hadith QA
Tafsir dan hadith memerlukan taxonomy review yang sesuai dengan jenis dakwaan. Bukan semua sebutan Islam memerlukan tahap review sama; tetapi isu yang substantif atau kontroversial perlu dinaikkan kepada reviewer kompeten.

### 5.7 Retractions, corrections dan freshness
Sumber akademik boleh berubah status. Sistem perlu menyokong: retraction; correction; erratum; freshness/revalidation.

### 5.8 Insufficient evidence
Jika evidence tidak mencukupi: `INSUFFICIENT_EVIDENCE` ialah outcome sah. Sistem tidak boleh memaksa AI "mencari jalan" menghasilkan fakta.

### 5.9 Hard Publication Gate
Artikel tidak diterbitkan hanya kerana prose kelihatan bagus. Hard conditions perlu dipenuhi sebelum publication. Final approval kekal tindakan manusia.

---

## SESI 6 — HUMAN–AI PRODUCTION ARCHITECTURE
**STATUS: PRE-PILOT ARCHITECTURE APPROVED / LOCKED FOR IMPLEMENTATION VALIDATION**

Sesi 6 telah dikunci sebagai architecture pra-pilot. Detail yang bergantung kepada data pilot masih boleh ditentukur berdasarkan evidence sebenar.

### 6.1 Entity State Isolation
Empat jenis entity tidak boleh dicampur lifecycle-nya: **Article, Research, Claim, Source**

### 6.2 Evidence-First Production
Evidence membatasi fakta. Narrative layer menentukan bagaimana fakta diterangkan. Jika Writer memperkenalkan material fact baharu, claim itu mesti kembali kepada Evidence/Claim process.

> Narrative freedom does not include factual freedom.

### 6.3 Pipeline MVP
Untuk 100 artikel pertama: **Research/Scope → Evidence/Claims → Writer → QA**

Agent swarm kompleks ditangguhkan.

### 6.4 Source ≠ Evidence
Source ialah objek bibliografi/dokumen. Evidence ialah relationship: `SOURCE → CLAIM`. Sumber tidak secara automatik menjadi evidence untuk setiap claim yang berkaitan topik tersebut.

### 6.5 Claim lifecycle
Claim mempunyai branching lifecycle: `CANDIDATE` kemudian boleh menjadi `VERIFIED`, `PARTIALLY_SUPPORTED`, `CONFLICTED`, `INSUFFICIENT_EVIDENCE`, `REJECTED`.

`CLAIM_DRIFT` bukan claim state. Ia ialah QA finding apabila prose tidak lagi setara dengan verified claim.

### 6.6 Dua failure mode penulisan
1. **Unsupported Claim Introduction** — Writer memperkenalkan material claim yang langsung tidak terdapat dalam Approved Claim Map.
2. **Claim Drift** — Writer bermula daripada approved claim tetapi mengubahnya (menaikkan certainty; menaikkan correlation menjadi causation; menambah nombor; menambah historical embellishment; memperluas scope).

Dua masalah ini perlu diukur secara berasingan.

### 6.7 Authority AI
Nama tindakan AI menggunakan istilah seperti `AI_PRECHECK`, `AI_CLASSIFICATION`, `AI_RECOMMENDATION`. AI tidak dinamakan atau direka sebagai "truth authority" atau "consensus authority".

### 6.8 Human review
Model: **Anomaly-driven Review + Editorial Spot-Check** — bukan anomaly-only review. Human sampling kekal walaupun sistem tidak mengesan masalah.

### 6.9 Islamic integration trigger
Research Brief boleh mempunyai `potential_islamic_integration: true`. Ini bukan lesen memasukkan ayat Quran atau tafsir. Attributed concordance hanya diaktifkan kemudian apabila terdapat provenance dan alasan editorial.

### 6.10 "Bagaimana Kita Tahu?" evidence grammar
Model umum: **OBSERVATION → EVIDENCE → INFERENCE → MODEL → LIMITATION**

Eksperimen ialah salah satu bentuk evidence, bukan syarat universal.

### 6.11 Freshness
Jangan hardcode revalidation interval sebelum mempunyai data. Simpan konsep seperti `freshness_class`, `next_review_at`, `review_reason` dan tentukan policy berdasarkan pengalaman corpus sebenar.

### 6.12 Architecture fixtures
Contoh teknikal menggunakan fixture neutral/unverified. Fixture architecture tidak boleh secara senyap berubah menjadi factual claim penerbitan.

### 6.13 Curated Corpus First
Prinsip: **Curated Corpus First, External Research Second.** User/editor akan membekalkan PDF KPM dan reference books terpilih kepada sistem AI.

**Source roles:**
- `CORE_CORPUS` — KPM textbooks dan institutional/core PDFs yang dipilih.
- `SUPPLEMENTARY_CORPUS` — Monographs, academic/reference books dan sumber tambahan yang diluluskan.
- `EXTERNAL_SOURCE` — Journal, database, portal dan sumber luar untuk targeted research.

### 6.14 Kedudukan KPM
KPM ialah **Curriculum Authority & Baseline Coverage Source**. KPM bukan universal scientific ground truth. Jika scientific accuracy/current knowledge memerlukan sumber luar, external research digunakan.

### 6.15 Corpus Retrieval & Evidence Mapping
Stage corpus: Research Brief + curated corpus → candidate claims → evidence spans → locators → corpus sufficiency

Empat outcome utama: `CORPUS_SUFFICIENT`, `CORPUS_PARTIAL`, `CORPUS_CONFLICT`, `CORPUS_INSUFFICIENT`/`EXTERNAL_RESEARCH_REQUIRED`. Evidence mesti mengekalkan locator seperti page/section.

### 6.16 Source lifecycle vs findings
Lifecycle sumber dan finding tidak dicampurkan.

Contoh lifecycle: `DISCOVERED → ACCESS_FAILED` atau `DISCOVERED → VALIDATED → ACTIVE/DEPRECATED`

Findings berasingan: `RETRACTION_DETECTED`, `CORRECTION_DETECTED`, `ERRATUM_DETECTED`. Parsing failure tidak sama dengan academic deprecation.

### 6.17 Attributed concordance
Prinsip: Hubungan boleh dibincangkan; tahap dakwaan mesti dijaga.

> Possible correspondence is not proof. Interpretation is not empirical evidence. Attribution prevents interpretation from masquerading as fact.

Lima keadaan:
1. `NONE` → PASS
2. `ATTRIBUTED_AND_SUPPORTED` → PASS selepas Lane 2/3 QA
3. `ATTRIBUTED_BUT_WEAK` → HUMAN EDITOR REVIEW
4. `UNATTRIBUTED_SPECULATION` → FAIL
5. `FORCED_CONCORDISM` → FAIL MUTLAK

Attribution boleh merujuk individu; karya; institusi; tradition; identifiable scholarly group.

### 6.18 Islamic reviewer triggers
Escalation berlaku apabila melibatkan: tafsir luar biasa/baharu; ikhtilaf penting; status/takhrij hadith; aqidah; controversial concordance; synthesis yang melampaui sumber; possible forced concordism; theological implication yang substantif.

### 6.19 Publication gate
Gate boleh deterministic bagi hard conditions. Tetapi: **Final publication approval remains human.**

### SESI 6 — IMPLEMENTATION APPENDIX A: Corpus Ingestion Specification v1
*STATUS: Candidate for implementation pilot; sebahagian Sesi 6, BUKAN "Sesi 6.1" atau sesi perancangan baharu.*

**A.1 Pipeline**
PDF RECEIVED → FILE VALIDATION → SOURCE REGISTRATION → PAGE EXTRACTION → LAYOUT/STRUCTURE PARSING → DOCUMENT HIERARCHY RECONSTRUCTION → SEMANTIC CHUNKING → TABLE/FIGURE/CAPTION EXTRACTION → QUALITY CHECK → SEARCH INDEXING → CORPUS_READY

**A.2 Prinsip ingestion**
- Curated Corpus First.
- External Research Second.
- Structure First, Token Size Second.
- Retrieval Is Not Evidence.
- Source Text Must Remain Auditable.
- Never Lose the Page Locator.
- Never Treat OCR Output as Automatically Correct.
- Figures and Tables Retain Their Context.
- KPM Defines Curriculum Baseline, Not Universal Scientific Truth.
- Corpus Architecture Must Remain Model-Independent.
- Do Not Automate What the Pilot Has Not Yet Proven Worth Automating.

**A.3 Source identity & versioning**
Setiap source mempunyai stable `source_id`. Setiap file/version direkod dengan SHA-256 hash. Edition/hash baharu tidak boleh overwrite source lama secara senyap. Evidence boleh dijejak kepada: source; source version; file hash; ingestion version; chunk version.

**A.4 Dual locator**
Simpan kedua-duanya: `pdf_page` (physical PDF index); `book_page_display` (nombor halaman tercetak). Jika printed page tidak diketahui: `book_page_display = null` — jangan invent.

**A.5 Document hierarchy**
Model: SOURCE → CHAPTER → SECTION → SUBSECTION → BLOCK → PARAGRAPH/LIST/TABLE/FIGURE/CAPTION

TOC boleh membantu structure reconstruction tetapi bukan factual evidence.

**A.6 Semantic chunking**
Chunking berdasarkan struktur semantik, bukan rigid token slicing. Keutamaan boundary: subsection → paragraph group → list → figure/table context → token limit

Candidate tunable defaults: target ~450 tokens; soft min ~150; soft max ~800. Angka ini bukan editorial policy LOCK.

Adjacent chunks perlu boleh diperluaskan semasa retrieval supaya evidence tidak quote-mined keluar konteks.

**A.7 Tables**
Table perlu mengekalkan: headers; rows; relationship struktur; serta representation teks untuk retrieval.

**A.8 Figures**
Figure ialah source object tersendiri. Machine-generated visual description tidak automatik menjadi evidence. Jika material fact hanya wujud dalam figure, review diperlukan.

Bezakan: internal source asset; publication asset. Hak menggunakan sesuatu figure sebagai evidence dalaman tidak semestinya memberi hak menerbitkannya semula.

**A.9 Captions dan footnotes**
Caption dikaitkan secara eksplisit kepada figure/table. Footnote dikaitkan dengan reference marker yang betul.

**A.10 OCR**
Gunakan native text layer apabila tersedia. OCR hanya apabila diperlukan. OCR-derived material perlu ditandai supaya uncertainty/review boleh dikendalikan.

**A.11 Formula dan notation**
Raw extraction disimpan. Normalized representation boleh diwujudkan tetapi: raw tidak dimusnahkan; normalization versioned.

**A.12 Retrieval**
Arah yang dipilih ialah hybrid retrieval: keyword/BM25/FTS; vector retrieval; metadata filtering; reranking. Exact engine/model belum LOCK.

Retrieval result hanyalah candidate evidence. Ia menjadi Evidence hanya apabila dipadankan kepada claim dan divalidasi.

**A.13 Evidence support types**
Antara klasifikasi: `DIRECT`, `PARTIAL`, `CONTEXTUAL`, `CONTRADICTS`, `NOT_RELEVANT`. Jangan menggunakan pseudo-precision seperti "93% factual confidence" tanpa asas.

**A.14 External research reason**
Trigger boleh menyimpan reason code seperti: `CORPUS_GAP`, `CURRENT_SCIENTIFIC_UPDATE`, `HISTORICAL_VERIFICATION`, `SOURCE_CONFLICT`, `PRIMARY_SOURCE_REQUIRED`, `ISLAMIC_SOURCE_REQUIRED`, `EXPERT_GUIDANCE_REQUIRED`

**A.15 Term extraction**
Automatic extraction hanya menghasilkan `TERM_CANDIDATE`. AI tidak secara automatik menentukan preferred terminology dalam TermBank.

**A.16 Parsing**
Parser boleh menggunakan: PDF outline/bookmark; font/layout hierarchy; numbering; TOC; AI structural classification. Uncertain structure → review flag. Repeated header/footer dibuang daripada semantic chunks. Multi-column reading order, sidebars dan landscape pages perlu dikendalikan.

**A.17 Language**
Simpan source language. Jangan translate semasa ingestion.

**A.18 MVP data objects**
Corpus layer: `sources`, `source_versions`, `source_pages`, `source_blocks`, `source_chunks`, `source_figures`, `source_tables`, `ingestion_runs`, `ingestion_findings`

Production layer menambah: `research_briefs`, `claims`, `evidence`, `articles`, `article_blocks`

Tidak perlu Neo4j/full KG untuk ingestion MVP.

**A.19 Re-ingestion**
Jika bibliographic source sama tetapi ingestion dilakukan semula: new ingestion version; new chunk version jika perlu; bukan cipta bibliographic source baharu tanpa sebab.

**A.20 Mini-pilot**
Sebelum full corpus ingestion, gunakan kira-kira 3 PDF representatif: KPM/core textbook; academic/reference book; institutional report/PDF.

Audit sekitar 20–30 halaman representatif dan 20–30 retrieval queries sebelum freeze ingestion implementation v1. Ini ialah implementation validation, bukan sesi perancangan tambahan.

### SESI 6 — PILOT MEASUREMENT
10-article pilot digunakan untuk mendapatkan empirical baseline. Tujuh metrik:
1. Corpus Coverage Rate
2. External Research Rate
3. Evidence Retrieval Accuracy
4. Unsupported Claim Introduction Rate
5. Claim Drift Rate
6. QA False-Negative Rate
7. Editor Correction Rate

Jangan menetapkan arbitrary success threshold sebelum pilot pertama.

---

## EDITORIAL HERITAGE — KIMIA UNTUK KANAK-KANAK

Buku lama Kimia untuk Kanak-kanak ialah nenek moyang konseptual Sains untuk Semua. Ia menunjukkan beberapa instinct yang kini menjadi sebahagian projek: curiosity questions; progressive depth; analogy; history/context; visual notes; percubaan menghubungkan perspektif Islam tanpa terus menyamakan zarah klasik dengan atom moden.

Tetapi keputusan rasmi ialah:

> The old book is editorial heritage, not scientific authority.

Ia boleh memberi inspirasi kepada: framing; progression; analogy pattern; editorial visual language. Ia bukan CORE_CORPUS, ground truth atau factual authority. Semua factual claims daripadanya perlu melalui pipeline evidence yang sama.

---

## SESI 7 — KNOWLEDGE ARCHITECTURE & NAVIGATION
**STATUS: LOCKED**

Prinsip utama:

> Taxonomy organizes the corpus. The knowledge graph connects knowledge. Navigation serves the reader.

Ketiga-tiganya tidak boleh dicampur menjadi satu sistem.

### 7.1 Canonical architecture
Satu konsep mempunyai: satu `canonical_entry_id`; satu `primary_taxonomy_location`; satu canonical owner. Entry yang sama boleh muncul melalui banyak discovery path tanpa diduplikasi.

### 7.2 Dual Reader Intent
Dua mental model utama:
- **Goal-oriented**: "Saya tahu apa yang saya cari." → Search → Canonical Entry
- **Curiosity-driven**: "Saya cuma tertanya-tanya." → Curiosity Question → Curated Journey → Canonical Entries

Prinsip: Knowledge architecture must support both concept navigation and curiosity journeys.

### 7.3 Broader ≠ prerequisite
`broader`/`narrower` ialah hubungan konsep. `prerequisite` ialah learning relationship. Jangan campurkan kedua-duanya.

### 7.4 Prerequisite adalah soft
Dua tahap yang dipertimbangkan: `HELPFUL_BEFORE`, `RECOMMENDED_BEFORE`. Ia tidak menghasilkan hard unlocking. Sains untuk Semua bukan LMS.

### 7.5 Four-direction reader navigation
Mental model pembaca: ↑ Lebih luas/bigger picture · ↓ Lebih dalam/narrower · ← Fahami dahulu/prerequisite · → Berkaitan/lateral exploration

Ini bukan empat `relation_type` backend.

### 7.6 Related concepts
Related concept mesti mempunyai semantic reason. Jangan menghasilkan link hanya untuk mencapai quota. Frontend hanya memaparkan beberapa hubungan paling berguna.

### 7.7 Search + Browse
Kedua-duanya first-class. Search untuk intent langsung. Browse untuk exploration. Sembilan pintu Science ialah reader-facing browse layer dan tidak perlu mendedahkan backend taxonomy secara mekanikal.

### 7.8 Collections
Collection ialah editorial layer, bukan taxonomy. Ia boleh mengumpulkan Canonical Entries mengikut persoalan atau tujuan editorial.

### 7.9 Curiosity Journey
Curiosity Journey ialah Collection subtype/presentation layer, bukan jenis artikel baru. Ia tidak menduplikasi Canonical Entry.

### 7.10 Curated Journey ≠ prerequisite graph
Journey boleh memilih susunan naratif yang baik. Susunan itu tidak mengubah relationship epistemik/prerequisite sebenar dalam knowledge graph.

### 7.11 Cross-domain relationship
Prinsip: **Cross-Domain Relationship Is Derived, Not Invented.** Sesuatu relationship hanya dianggap cross-domain jika semantic edge yang sah memang wujud dan source/target berada dalam domain berbeza. Perbezaan domain tidak mencipta relationship.

### 7.12 Orphan dan link spam
Tiada arbitrary minimum edge count. Tetapi entry yang menjadi orphan tanpa editorial reason perlu ditandai sebelum publication. Begitu juga link spam perlu dicegah.

### 7.13 Database MVP
Gunakan relational knowledge graph dalam PostgreSQL untuk MVP.

Minimum:
- **Entry**: `canonical_entry_id`, `canonical_owner`, `primary_taxonomy_location`, `portal_id`
- **EntryRelation**: `source_entry`, `target_entry`, `relation_type`, `editorial_status` (Cross-domain boleh derived)
- **Collection** / **CollectionEntry**: ordered membership. Collection boleh mempunyai `collection_type`, optional `curiosity_question`.

Tidak perlu Neo4j untuk 100 artikel pertama.

### 7.14 Multi-portal readiness
Simpan konsep seperti `canonical_owner`, `portal_id`, `domain_id` dari awal. Tetapi Science tetap portal pertama.

### 7.15 Exploratory navigation
Pembaca tidak dipaksa mengikuti laluan; mereka sentiasa diberi pintu untuk pergi lebih luas, lebih dalam, ke belakang, atau ke sisi.

Protective rule: Build enough graph to help curiosity travel — not enough graph to model the universe.

### 7.16 Search Canonicality
Search mengutamakan Canonical Entry. Jangan hasilkan pseudo-entry atau duplicate answer page hanya untuk query tertentu.

### 7.17 Inline Link Discipline
Inline link digunakan secara selektif, lazimnya pada first meaningful occurrence apabila destination benar-benar membantu. Artikel bukan halaman penuh hyperlink.

### 7.18 Editorial Heritage Rule
Material lama seperti Kimia untuk Kanak-kanak boleh mempengaruhi curiosity journeys dan editorial framing tetapi tidak secara automatik menentukan taxonomy, graph atau factual claims.

### 7.19 Yang sengaja tidak LOCK dalam Sesi 7
Belum ditentukan: exact max related links; relationship ranking algorithm; search reranker; embedding model; exact prerequisite depth; public frontend name bagi "Journey"; graph database masa depan; recommendation AI; personalization; cross-portal edge cases; automatic graph generation; exact collection visual format; visual graph explorer.

---

## SESI 8 — PRODUCT UX, VISUAL & EDITORIAL DESIGN SYSTEM
**STATUS: FINAL LOCKED & CLOSED**

### 8.1 Tiga falsafah visual induk
- The article is the interface.
- Calm authority, not educational decoration.
- The layout adapts to the knowledge; the knowledge must never be padded to satisfy the layout.

### 8.2 Canonical Entry UX
Canonical Entry ialah primary reading object.

LOCK: Editorial Reading Canvas; tiada permanent utility sidebar; marginalia supplementary; progressive depth melalui reading, bukan UI operation; "Bagaimana Kita Tahu?" first-class; visual mesti earn space; navigation graph diterjemahkan kepada natural UI; auditability tersedia tanpa audit UI memenuhi skrin.

Protective rule: The model serves the UI; the UI does not expose the model.

### 8.3 Home / Search / Discovery
LOCK: Home = curiosity gateway, bukan content feed; one search surface, multiple intents; canonical answer first apabila intent jelas; Interpret, Don't Invent; Search + Browse saling melengkapi; taxonomy tidak bocor secara mekanikal ke discovery UX; Curiosity Journey ialah secondary discovery path; Ambiguity Must Be Visible; No Personalization Dependency for MVP; No-Answer Is Better Than Fabricated Answer.

Search integrity: The search engine may understand more than the reader typed, but it must never pretend the encyclopedia contains more than it actually does.

Baseline home boleh mengandungi: Search/Ask → Saya Cuma Tertanya-tanya → 9 Pintu Sains → Curiosity Journeys → optional Featured Entries. Featured section bukan mandatory.

### 8.4 Curiosity Journey UX
LOCK: Journey Is an Editorial Path, Not a Course; Question First; Journey Connects, Canonical Entries Explain; Ordered but Unlocked; Why Next, Not Just What Next; Canonical Entry Remains Stateless; No Progress UI by Default; Primary Path, Open Exploration; Return to Original Question; Journey Prose Is Also Governed Content.

Protective: A Journey should explain why the next concept matters, not merely what comes next. Journey connects knowledge; canonical entries explain knowledge.

### 8.5 Visual Design System
LOCK: Calm Authority; Neutral-First Palette; Colour Is Semantic Before Decorative; One Publication Identity Across Domains; Editorial Typography + Quiet Interface Typography; Whitespace Is Structural; Typography and Space Before Containers; Controlled Reading Measure; Marginalia Must Be Visually Subordinate; First-Class Sections Need Distinction, Not Decoration; One Scientific Illustration Language.

Protective: If everything is highlighted, nothing is highlighted. A science visual should clarify structure, scale, process, comparison or evidence — otherwise it probably does not need to exist.

### 8.6 Adaptive Canvas
Model B — Modern Knowledge Publication — ialah default visual DNA. Tetapi: One Adaptive Canvas, Not Three Templates. Artikel text-heavy boleh bergerak ke arah Pure Editorial. Artikel visual-heavy boleh meluaskan scientific canvas. Editor tidak memilih template A/B/C.

LOCK: content determines width; margins are space, not panels; no visual quota.

### 8.7 Editorial component hierarchy
- **Tier 1 — Primary**: prose; headings; scientific diagrams; Bagaimana Kita Tahu?; essential formula/table.
- **Tier 2 — Supporting**: marginalia; terminology/definition; analogy; photography; historical/source context.
- **Tier 3 — Audit/reference**: provenance; source detail; review/update metadata.

Principles: Component Minimalism; Primary vs Supporting vs Audit Layers; Marginalia Must Remain Non-Essential; Definitions Are Precision Tools; Analogies Must Declare Limits When Needed; Bagaimana Kita Tahu? epistemically structured but visually natural; Diagram, Photo and Table Have Different Jobs; Captions Guide Attention; Formula Must Be Interpreted; Provenance Uses Progressive Disclosure.

Protective: Do not create a component for every editorial label. If removing a supporting component breaks the explanation, that content belongs in the main flow. A component exists to clarify information structure, not to decorate empty space.

### 8.8 Scientific visual grammar
General rule: Photo shows reality; diagram explains relationship.

Diagram editorial classes: structural; process; comparative/scale.

Visual language: clean vector; restrained strokes; flat shapes; clear labels; no fake 3D kecuali spatial understanding memerlukannya; no glossy gradients; no mascot; arrows hanya apabila membawa makna.

Caption mengarahkan perhatian kepada perkara yang penting, bukan sekadar memberi nama gambar. Material factual claims dalam caption tetap memerlukan provenance.

### 8.9 Islamic visual treatment
Sacred text tidak diberikan "Islamic decoration" generik seperti frame emas, kubah atau motif semata-mata kerana ia Islam.

Prinsip: Sacred text receives typographic respect, not decorative spectacle.

Arabic text, translation dan attribution/tafsir perlu dibezakan dengan jelas.

### 8.10 Responsive & Accessibility
Baseline: **WCAG 2.2 AA**

LOCK: Semantic Order Before Visual Position; Mobile Is a First-Class Reading Environment; Controlled Reading Measure, Adaptive Canvas; Marginalia Degrades Gracefully; Native Semantics Before Custom Interaction; Colour Never Carries Meaning Alone; Accessibility Contrast Is a System Constraint; Motion Is Progressive Enhancement; Scientific Visuals Require Accessible Meaning; Tables and Formulae Preserve Their Information Structure; RTL/Arabic/Jawi Are Semantically Supported; Document Structure Is Machine-Readable.

Protective: Responsive design may rearrange information, but it must never rewrite its hierarchy. If knowledge can only be understood by seeing a colour, animation, hover state, or exact visual position, the design is incomplete. Premium visual restraint must never be purchased with reduced readability. Accessibility exceptions require a reason; accessibility itself does not.

### 8.11 Accessible scientific visuals
Gunakan lapisan yang sesuai: short alt; caption; extended description apabila complexity/essential meaning memerlukannya; textual/table equivalent apabila data memerlukannya. Tidak semua visual wajib mempunyai description panjang. Essential scientific meaning mesti mempunyai accessible route.

### 8.12 Arabic/Jawi/RTL
Directionality ialah semantic concern. Gunakan markup RTL/LTR yang sesuai. Mixed: Arabic; Jawi; BM Latin; nombor; punctuation; citation — perlu berfungsi dengan betul. Arabic/Jawi ialah first-class typography dari awal.

### 8.13 Document semantics
Gunakan hierarchy sebenar: H1 → H2 → H3 — bukan heading berdasarkan rupa visual. Meaningful sections boleh mempunyai stable anchors seperti `/atom#bagaimana-kita-tahu`. Tetapi jangan anchor setiap perenggan.

### 8.14 Belum LOCK dalam Sesi 8
Implementation akan menentukan: exact hex; font families; font sizes; line-height; exact CPL; exact article width; breakpoints; spacing values; radius; borders; shadows; icon set; diagram palette; focus ring styling; touch dimensions; ARIA implementation; table responsive algorithm; math renderer; provenance drawer/page pattern; animation library.

---

## SESI 9 — TECHNICAL ARCHITECTURE & DEPLOYMENT
**STATUS: FINAL LOCKED & CLOSED**

*Hubungan dengan SSOT: Mengikat keputusan teknikal kepada Sesi 1–8 tanpa mengubah product, editorial, provenance, knowledge architecture atau UX yang telah LOCK.*

### 9.1 Prinsip seni bina
- Boring infrastructure, sophisticated editorial logic.
- Published knowledge must remain readable even if every AI provider is offline.
- Build for recoverability and auditability before building for hypothetical scale.

Sistem mengutamakan: kesederhanaan operasi; provenance; recoverability; modularity; portability; dan kos yang munasabah. Infrastructure bukan tempat projek mencari differentiation.

### 9.2 Architecture
- **Modular Monolith + Async Workers.** MVP menggunakan modular monolith, bukan microservices. Background work yang berat/lambat dijalankan melalui asynchronous workers.
- **TypeScript product stack.** Public web dan application/domain layer menggunakan Next.js + TypeScript. Business rules tidak diletakkan secara rawak dalam React components atau API routes.
- **Specialized Python corpus worker.** Python digunakan khusus untuk PDF processing, OCR apabila diperlukan, layout/document parsing, scientific document tooling. Python worker bukan second source of business truth.
- **PostgreSQL system of record.** Satu managed PostgreSQL deployment mencukupi untuk MVP, dengan logical domain boundaries.
- **Relational knowledge graph.** Keputusan Sesi 7 kekal: Knowledge graph MVP = relational graph dalam PostgreSQL. Tiada keperluan Neo4j pada MVP.

### 9.3 Search & AI
- **PostgreSQL-native hybrid search first**: PostgreSQL FTS; fuzzy/trigram; pgvector; metadata filtering; reranking. External dedicated search engine belum diperlukan.
- **Search retrieves corpus knowledge.** Public search tidak menjadi chatbot yang menjana jawapan saintifik baharu — search returns corpus knowledge, not generated answers. AI boleh interpret intent, normalize query, detect synonym, rewrite query, rerank candidates — tetapi tidak boleh bypass editorial corpus.
- **AI provider abstraction.** AI provider/model tidak di-hardwire sebagai domain architecture; AI integration menggunakan adapter/boundary tersendiri.
- **Least-privilege AI.** AI hanya menerima context, permissions, tools yang diperlukan. Tidak menerima unrestricted corpus/database/publication authority.

### 9.4 Corpus & storage
- **S3-compatible object storage.** Binary seperti PDF dan publication assets disimpan dalam object storage, bukan PostgreSQL.
- **Corpus/publication separation.** corpus-private dan publication-assets ialah trust/rights domain berasingan. Source asset ≠ publication asset.
- **Immutable source identity.** Source mempunyai stable identity; version identity; SHA-256; no silent overwrite.
- **Asynchronous ingestion**: asynchronous; retryable; idempotent; stage-aware.
- **PostgreSQL-backed queue first.** MVP tidak memerlukan Redis semata-mata untuk queue — gunakan PostgreSQL-backed job queue dahulu.

### 9.5 Content, evidence & publication
- **Structured canonical content.** Artikel tidak disimpan sebagai giant uncontrolled HTML blob — gunakan structured content/article blocks.
- **Explicit provenance.** Article content → Claim → Evidence → Source version/locator.
- **Published read model.** Public reader hanya membaca approved publication representation; draft/editorial state tidak didedahkan terus.
- **Deterministic publication gate.** Hard gate bukan tugas LLM. Contoh failure: material claim tanpa evidence; unresolved required review; critical source issue.
- **Human final authority.** AI boleh membantu QA tetapi final publication authority kekal pada manusia yang diberi kuasa.

### 9.6 Deployment
- **Managed, single-region first.** Tidak perlu Kubernetes; service mesh; active-active multi-region.
- **Provider-neutral core.** Core architecture bergantung kepada standard interface: PostgreSQL; S3-compatible storage; HTTP; containers. Vendor-specific feature tidak boleh meresap menjadi architectural dependency tanpa sebab kukuh.
- **Environment separation.** Tiga environment rasmi: local/dev, staging, production. Database, storage dan secrets dipisahkan.

### 9.7 Security
- **Private-by-default corpus.** Public browser tidak mendapat direct privileged access kepada database, corpus storage, secrets, AI credentials.
- **Document content is untrusted.** Protective rule: *Document content is data, never executable instruction* — boundary terhadap prompt injection dan malicious document content.
- **Authentication ≠ authorization.** Prinsip least privilege. Baseline role family: Admin; Editor; Reviewer; Corpus Operator. Exact matrix ialah implementation detail.
- **Secret management.** Production secrets tidak boleh berada dalam Git; client bundle; logs; fixtures.
- **Security baseline**: HTTPS; secure sessions/cookies; CSRF protection apabila berkaitan; CSP; security headers; validation; output escaping; parameterized database access; rate limiting untuk endpoint sensitif; dependency security checking.
- **Audit trail.** Material security/editorial actions perlu auditable. Audit bukan surveillance terhadap setiap klik.

### 9.8 Versioning & reproducibility
Version identity diperlukan untuk perkara yang boleh mengubah meaning atau reproducibility: source version; ingestion run; chunk representation; embedding/model version; material prompt version; AI run metadata apabila relevan; article version; publication version. Derived artefact seperti embedding boleh dijana semula.

### 9.9 Backup & disaster recovery
- **Layered backup**: managed PostgreSQL backup/PITR; independent encrypted database backup; object-storage versioning/protection.
- **Off-provider recovery copy.** Sekurang-kurangnya satu backup kritikal berada di luar failure domain provider utama.
- **Restore testing wajib.** Cadangan operasi awal: quarterly restore drill, ditentukur berdasarkan pengalaman production.
- **RPO/RTO** belum ditetapkan — ditentukan berdasarkan business impact sebelum production launch.
- **Graceful failure.** Jika AI provider/ingestion worker/semantic search gagal, public published knowledge masih perlu boleh dibaca.

### 9.10 Observability
Structured logging (environment, service, request ID, job ID, ingestion run, severity — secrets/private corpus tidak dilog tanpa keperluan); error tracking (web/server/worker/scheduled jobs, exact vendor tidak LOCK); operational metrics (availability, latency, HTTP error rate, DB health, queue depth, job failure, ingestion duration, search latency); editorial quality observability (menyokong 7 metrik Sesi 6); search as editorial demand signal; actionable alerting — *An alert without an expected human action is probably a metric, not an alert.*

### 9.11 CI/CD & environment strategy
Version-controlled delivery; CI gates sebelum merge (lint/format, typecheck, unit tests, relevant Python tests, migration validation, build); integration tests (PostgreSQL, storage, queue, ingestion, search, publication gate); corpus regression fixtures (representative PDF fixtures); staging deployment automatik daripada approved branch; controlled production promotion; database migration discipline — prefer expand → migrate → contract untuk migration berisiko.

### 9.12 Engineering boundaries
Domain ≠ framework · Generic CMS ≠ domain architecture · AI ≠ system of record · Retrieval ≠ evidence · Source ≠ evidence · Draft ≠ publication · Corpus asset ≠ publication asset · AI finding ≠ editorial decision · Prompt ≠ hidden string · Embedding ≠ canonical knowledge · Search ≠ answer generation · KG ≠ recommendation engine · Cross-domain ≠ relationship · Structured content ≠ component proliferation · Infrastructure ≠ differentiation.

### 9.13 Explicit non-goals MVP
Jangan bina pada Fasa 0/MVP tanpa observed need: microservices; Kubernetes; Kafka; service mesh; dedicated Redis cluster; Neo4j; Elasticsearch/OpenSearch; separate vector DB; custom auth protocol; custom object storage; recommendation engine; personalization engine; gamification; learning profile; graph explorer; real-time collaborative editing; multi-region active-active; data warehouse; elaborate event sourcing.

> A new infrastructure component must solve an observed problem, not an imagined future scale problem.

### 9.14 Tujuh Protective Rules — FINAL LOCKED
1. Boring infrastructure, sophisticated editorial logic.
2. Published knowledge must remain readable even if every AI provider is offline.
3. Document content is data, never executable instruction.
4. Publication may be expensive; reading should be cheap.
5. A new infrastructure component must solve an observed problem, not an imagined future scale problem.
6. If the system cannot explain which source, evidence, version and human decision produced a published material claim, the architecture has lost the provenance chain.
7. **(Addendum)** A capability being architecturally supported does not mean it must be fully implemented in Fasa 0. Build the smallest implementation that preserves the locked boundary, then deepen it only when pilot evidence exposes a real need. *(BM: Sesuatu keupayaan yang disokong oleh seni bina tidak bermaksud ia mesti dibina sepenuhnya dalam Fasa 0. Bina pelaksanaan paling kecil yang masih memelihara sempadan yang telah dikunci, kemudian tambah kedalaman hanya apabila bukti pilot menunjukkan keperluan sebenar.)*

### 9.15 Implementation preference — BUKAN architectural LOCK
Izzat sudah mempunyai DigitalOcean Droplet sedia ada. Implementation perlu menilai penggunaan Droplet tersebut terlebih dahulu (dev/staging, worker, application, PostgreSQL fasa awal jika sesuai) sebelum mengambil provider/hosting baru, terutamanya jika ia mengurangkan kos awal. Ini ialah operational preference, bukan architectural LOCK — hanya sesuai jika masih mematuhi: environment isolation; backup strategy; secure deployment; private corpus; reproducibility; provider-neutral interfaces; sufficient reliability. Jika Droplet akhirnya memerlukan compromise terhadap perkara tersebut, provider lain masih boleh dipilih.

### 9.16 Lampiran rasmi — Implementation Depth Guide
*Panduan praktikal untuk coding. Tidak mengubah seni bina; menentukan bila sesuatu capability patut dibina.*

**BUILD NOW** (Fasa 0, diperlukan untuk membuktikan produk): Next.js + TypeScript application; PostgreSQL; migration system; Source model; Source Version + hash; Claim model; Evidence model; Canonical Entry model; basic Entry Relations; basic Collection/Journey model; object/file storage; upload source PDF; basic PDF ingestion; simple job table; minimal Python worker/CLI; article version/status; structured article content; deterministic publication gate; public Canonical Entry renderer; exact title/alias search; PostgreSQL FTS; trigram/fuzzy search; basic provenance; private corpus/public asset separation; basic authentication untuk editorial access; simple authorization; structured logs; basic error capture; database backup; local/dev + production separation; minimal staging path; CI asas (lint, typecheck, tests, build).

> Prinsipnya: bina laluan lengkap paling kecil — Source → Evidence → Claim → Article → QA → Publish → Search → Read — daripada membina setiap subsystem secara mendalam sebelum artikel pertama boleh diterbitkan.

**BUILD WHEN PILOT NEEDS IT** (selepas 10-article pilot atau penggunaan awal menunjukkan keperluan): pgvector; semantic search; embeddings; reranking lebih sophisticated; richer PDF structure extraction; OCR automation tambahan; table/figure extraction automation; expanded RBAC; automated editorial quality metrics; richer search analytics; richer provenance UI; more sophisticated queue handling; dedicated staging worker; automated prompt/model-run dashboards; stronger ingestion monitoring; advanced corpus-quality tooling; more complete accessibility regression automation. Tidak perlu dibina hanya kerana schema menyokongnya.

**BUILD ONLY AFTER REAL SCALE/PAIN** (jangan bina sebelum masalah nyata wujud): microservices; Kubernetes; service mesh; Kafka; Redis cluster; external search engine; dedicated vector database; Neo4j; recommendation engine; personalization engine; SSO kompleks; seat-management system; sophisticated institutional billing engine; multi-region active-active; custom observability stack; data warehouse; autoscaling architecture kompleks; event sourcing; real-time collaborative editing.

> Rule: No infrastructure promotion without an observed bottleneck, operational pain, reliability requirement or business need.

---

## SESI 10 — LAUNCH, BUSINESS MODEL & ROADMAP
**STATUS: FINAL LOCKED & CLOSED**

> Launch enough knowledge to prove usefulness, not enough pages to imitate a mature encyclopedia.

### 10.1 Launch model
1. **Progressive Launch, Not Big Bang.** Urutan: Internal validation → Private Alpha → Public Beta → Institutional Pilot → Broader Commercialization. Tidak menunggu portal kelihatan seperti ensiklopedia matang sebelum mendapat pengguna sebenar.
2. **~100 Canonical Entries = Foundational Corpus Milestone.** Wording FINAL: *Approximately 100 Strong Canonical Entries Is the First Foundational Corpus Milestone, Not a Hard Public-Beta Requirement.* Public Beta boleh berlaku lebih awal apabila terdapat beberapa cluster pengetahuan yang coherent, interconnected, genuinely useful, dan product readiness mencukupi. 100 ialah milestone pembangunan corpus, bukan syarat mutlak launch.
3. **Launch Corpus Must Be Interconnected.** Lebih baik 50–100 entry yang saling berkait daripada 100 artikel rawak tanpa knowledge structure.
4. **MVP Includes Editorial Operations, Not Only Public UI.** MVP sebenar merangkumi: Public (homepage, search, 9 Pintu Sains, Canonical Entry, relationships, Curiosity Journey/Collections, provenance disclosure, responsive/accessibility); Editorial (corpus ingestion, Source, Claim, Evidence, article workflow, QA, publication gate, versioning); Operations (deployment, backup, monitoring, restore capability).
5. **Launch Is Gate-Based, Not Date-Only.** Public Beta bergantung pada product readiness, editorial integrity, operational readiness, security readiness — bukan semata-mata tarikh atau article count.

### 10.2 Publisher & business identity
6. **Adjung Press Is the Publisher.** Sains untuk Semua ialah product/editorial property Adjung Press.
7. **Malians Group Is the First Commercial/Sponsorship Partner, Not the Publisher.** Malians ialah sponsor; distribution channel; institutional partner.
8. **Editorial Independence Is Non-Negotiable.** *Money may fund access; it may not purchase scientific conclusions.* Sponsor tidak boleh: menentukan conclusion; memadam fakta yang tidak disukai; memaksa scientific framing; mengubah evidence threshold.

### 10.3 Access & monetization
9. **Public Knowledge Layer Remains Important.** Jangan hard-paywall keseluruhan encyclopedia pada launch. Canonical knowledge asas perlu mempunyai public discovery/readability yang kuat.
10. **Institutional Layer Is a Separate Product Layer.** Institusi tidak semestinya membayar semata-mata untuk membaca artikel. Institutional value boleh datang daripada sponsored access, curated access, organisational entitlement, institutional onboarding, future institutional services. Premium feature tidak boleh dicipta hanya untuk mewajarkan caj.
11. **Licensing Architecture Supports Several Models, But Pilot Implements One First.** Wording FINAL: *The business architecture must not prevent direct, sponsored or bundled institutional licensing, but only the Malians-sponsored/bundled model needs implementation for the first institutional pilot.* Secara konseptual sistem boleh menyokong direct/sponsored/bundled institutional licence, tetapi Fasa awal tidak perlu membina billing system untuk ketiga-tiganya. Model pertama: Malians-sponsored/bundled school access.
12. **Exact Pricing Is Deferred Until Pilot Evidence.** Harga tidak LOCK sekarang — perlu data sebenar tentang willingness to pay, usage, sponsor economics, cost to serve, school response.

### 10.4 Institutional model
13. **Organisation-Centric Concept, Minimal Pilot Implementation.** Wording FINAL: *Organisation-centric is the conceptual ownership model; the first pilot may use manual or minimal entitlement administration.* Entitlement berkait dengan organisasi/sekolah, tetapi pilot pertama tidak memerlukan SSO, seat management, sophisticated school admin portal, automated renewal, atau invitation workflow kompleks. Manual admin, code atau simple entitlement record sudah memadai.
14. **Malians-Sponsored School Access Is the First Business Pilot.** Model: tempah pakaian sekolah dengan Malians Group → sekolah menerima akses Sains untuk Semua selama tempoh yang ditentukan, ditaja oleh Malians Group. Exact package/price/duration operational masih boleh diuji.
15. **Sponsor Branding Is Subordinate.** Portal kekal identiti Adjung Press/Sains untuk Semua. Sponsor recognition boleh wujud, tetapi tidak menukar portal menjadi Malians microsite.

### 10.5 Success metrics
16. **Four Metric Families**: Editorial Quality (Corpus Coverage Rate, External Research Rate, Evidence Retrieval Accuracy, Unsupported Claim Introduction, Claim Drift, QA False-Negative, Editor Correction); Reader Usefulness (successful search, no-result rate, useful continuation, related exploration, Journey engagement); Institutional Adoption (schools activated, repeat use, adoption, renewal intent, sponsor continuation); Business Impact (sales differentiation, acquisition, retention, sponsor cost/value, effect on Malians school relationships).
17. **Article Count and Page Views Are Not Primary Success Metrics.** Soalan utama: Adakah pembaca berjaya menemui, memahami dan mempercayai pengetahuan yang mereka cari?
18. **Search Gaps Are Editorial Demand Signals.** No-result/ambiguous search boleh mempengaruhi editorial backlog, tetapi: *Search demand should guide editorial priorities, not turn the encyclopedia into a content farm.*

### 10.6 Roadmap
19. **Capability-Gated, Not Calendar-Driven.** Roadmap bergerak apabila capability sebelumnya stabil — bukan "Bulan 3 mesti ada 500 artikel."
20. **10-Article Editorial Pilot Before Large-Scale Corpus Production.** Pilot pertama menguji ingestion, retrieval, evidence, Writer, QA, publication, metrics. Selepas itu barulah scale production.
21. **Public Beta Before Broad Institutional Commercialization.** Jangan cuba menjual luas sebelum portal sebenar boleh digunakan, search/discovery berfungsi, editorial integrity dapat dibuktikan.
22. **~500 High-Quality Entries as Next Major Maturity Milestone.** Selepas foundational corpus, sasaran seterusnya kira-kira 500 entry berkualiti tinggi — bukan 5,000 generated articles.
23. **Additional Knowledge Portals Reuse the Shared Platform.** Portal kedua tidak bermula dengan clone codebase — kongsi ingestion, provenance, search, editorial workflow, canonical architecture, UI primitives. Candidate paling natural selepas Science matang: Matematik. Tarikh tidak LOCK.
24. **Avoid Premature Product Expansion.** Jangan secara automatik membina: 10,000 artikel AI; LMS; gamification; social network; generic AI tutor; native mobile app; intrusive advertising; banyak portal serentak. Setiap expansion perlu menunjukkan evidence manfaat.

### 10.7 Roadmap operasi rasmi
- **Phase 0 — Foundation**: repository; DB/domain model; basic ingestion; Canonical Entry renderer; provenance; search baseline; publication gate; deployment foundations.
- **Phase 1 — 10-Article Editorial Pilot**: ingest representative corpus; produce ten real entries; measure Sesi 6 metrics; identify actual failure modes.
- **Phase 2 — Foundational Corpus**: bina coherent clusters; menuju milestone ~100 entries; validate Journey; stabilize public UX.
- **Phase 3 — Public Beta**: buka portal; collect search gaps; observe reader behaviour; fix product friction.
- **Phase 4 — Institutional Pilot**: Malians-sponsored schools; minimal/manual entitlement; measure institutional usefulness dan Malians business impact.
- **Phase 5 — Content Scale**: berkembang ke sekitar 500 strong entries; strengthen knowledge graph; improve search dan editorial throughput.
- **Phase 6 — Broader Institutional Model**: selepas pilot terbukti — sponsored programmes; direct institutional licensing; other partners/CSR.
- **Phase 7 — Second Knowledge Portal**: hanya selepas operating model Science benar-benar stabil.

### 10.8 Enam Protective Rules Sesi 10 — FINAL LOCKED
1. Launch enough knowledge to prove usefulness, not enough pages to imitate a mature encyclopedia.
2. Quality is a release condition; article count is a planning target.
3. Money may fund access; it may not purchase scientific conclusions.
4. Do not invent premium features merely to justify charging.
5. Search demand should guide editorial priorities, not turn the encyclopedia into a content farm.
6. Every expansion must earn its complexity through reader, editorial or business evidence.

### 10.9 Sengaja belum LOCK — BUKAN blocker Fasa 0
Tidak perlu ditentukan sebelum coding bermula: exact public launch date; exact institutional price; exact pilot school count; school login method; sponsor logo placement; contract legal wording; renewal price; CSR package; analytics vendor; Math launch date; mobile app decision; advertising model; exact institutional dashboard; exact 500-entry timeline. Ia akan diputuskan daripada evidence, bukan spekulasi.

---

## MVP BOUNDARIES YANG TELAH DISEPAKATI

MVP bukan usaha membina "seluruh ensiklopedia". Fokus awal:
- sekitar 100 Canonical Entries sebagai testbed;
- Science first;
- 4-stage editorial production pipeline;
- curated corpus;
- evidence mapping;
- human QA;
- relational knowledge graph;
- Search + Browse;
- Canonical Entry;
- Collections/Curiosity Journey capability;
- responsive/adaptive reading canvas;
- provenance capability;
- WCAG 2.2 AA baseline.

**Tidak diperlukan untuk MVP:** Neo4j; agent swarm besar; recommendation AI; personalization dependency; gamification; LMS; progress system; visual graph explorer; automatic knowledge graph generation; perfect ontology.

Tiada angka "minimum tiga Curiosity Journeys" telah LOCK. Tiada keputusan bahawa MVP mesti mempunyai atau tidak mempunyai akaun pengguna telah LOCK.

---

## PERKARA YANG TIDAK BOLEH DICAMPUR

Ini penting untuk engineering:

- Taxonomy ≠ Knowledge Graph ≠ Reader Navigation
- Source ≠ Evidence
- Claim state ≠ QA finding
- Retrieval result ≠ Evidence
- KPM baseline ≠ universal scientific truth
- Curiosity Journey ≠ Canonical Entry
- Curated Journey ≠ prerequisite graph
- Cross-domain classification ≠ relationship creation
- Islamic attribution ≠ scientific evidence
- Editorial heritage ≠ factual authority
- Accessibility ≠ optional enhancement

---

## FASA 0 — APA YANG BOLEH DIMULAKAN SEKARANG

Sesi 1–8 sudah cukup matang untuk memulakan Fasa 0 engineering/prototyping yang reversible.

Fasa 0 boleh mula dengan asas yang tidak bergantung kepada keputusan Sesi 9–10, khususnya:

content/domain model → database skeleton → corpus ingestion prototype → Canonical Entry renderer → Adaptive Canvas → basic taxonomy/KG relationships → provenance model → accessibility foundation → pilot fixtures/tests.

Prinsip penting:

> Fasa 0 tidak boleh secara senyap membuat keputusan irreversible yang sebenarnya berada dalam bidang Sesi 9 atau Sesi 10.

Contohnya, jangan lock production infrastructure, deployment topology atau business entitlement architecture hanya kerana coding sudah bermula.

---

## STATUS RASMI PERANCANGAN

| Sesi | Tajuk | Status |
|------|-------|--------|
| 1 | Product Definition & Positioning | FINAL LOCKED & CLOSED |
| 2 | Scope, Taxonomy & Canonical Knowledge Structure | FINAL LOCKED & CLOSED |
| 3 | Editorial Grammar & Article Anatomy | FINAL LOCKED & CLOSED |
| 4 | Language, House Style & Tauhid Editorial Philosophy | FINAL LOCKED & CLOSED |
| 5 | Sources, Provenance & Fact-Checking | FINAL LOCKED & CLOSED |
| 6 | Human–AI Production Architecture + Corpus Ingestion Appendix | FINAL LOCKED & CLOSED untuk architecture; empirical tuning melalui pilot |
| 7 | Knowledge Architecture & Navigation | FINAL LOCKED & CLOSED |
| 8 | Product UX, Visual & Editorial Design System | FINAL LOCKED & CLOSED |
| 9 | Technical Architecture & Deployment | FINAL LOCKED & CLOSED |
| 10 | Launch, Business Model & Roadmap | FINAL LOCKED & CLOSED |

**MASTER BLUEPRINT SESSIONS 1–10: FINAL LOCKED & CLOSED.**

---

## Kesimpulan rasmi

SSOT v2.0 ini ialah rujukan muktamad bagi keputusan Sesi 1–10 — kesemua 10 sesi perancangan Sains untuk Semua kini FINAL LOCKED & CLOSED. Semua keputusan strategik yang perlu untuk memulakan pembinaan telah cukup. Tiada lagi sesi perancangan utama yang perlu ditunggu sebelum: membuka repo; membina schema; mengimplementasi Source/Claim/Evidence; menguji corpus ingestion; membina Canonical Entry; membina publication gate; menjalankan 10-article pilot.

Perkara yang masih "deferred" dalam blueprint ini (contoh: exact pricing, exact launch date, exact hex/font, provider hosting akhir) ialah implementation choices atau decisions yang memang sengaja menunggu evidence — bukan blocker kepada coding. Rujuk §9.16 (Implementation Depth Guide) untuk panduan BUILD NOW / BUILD WHEN PILOT NEEDS IT / BUILD ONLY AFTER REAL SCALE atau PAIN semasa Fasa 0.

Mulai titik ini, default kerja patut berubah daripada "Apa lagi yang perlu kita rancang?" kepada **"Apa perkara paling kecil yang boleh kita bina sekarang untuk menguji keputusan yang sudah kita buat?"**

Itulah penghujung rasmi perancangan Sains untuk Semua dan permulaan Fasa 0.

---

*Dokumen ini disediakan oleh ChatGPT (thread "Idea Ensiklopedia STEM Kanak Kanak"). Sesi 1–8 disahkan menggantikan versi konsolidasi awal Gemini yang mengandungi beberapa kesilapan atribusi/fakta. Sesi 9–10 (termasuk audit over-engineering dan Implementation Depth Guide) dirunding terus dengan ChatGPT selepas relay Gemini dihentikan atas arahan Izzat. Direlay dan disusun oleh Claude bagi pihak Izzat.*
