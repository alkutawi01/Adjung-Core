import { User, UserRole, Entry, WriterProfile, IdentityProfile, DigitalSignature, Citation, SystemSettings, BiographyItem, SystemLog, ReleaseLog, PolicyDocument } from '../types';
import { BRAND } from '../config/brand';

export const INITIAL_RELEASE_LOGS: ReleaseLog[] = [
  {
    id: 'rel-1.0',
    version: 'v1.0.0',
    date: '2026-06-01T00:00:00Z',
    changes: {
      added: [
        'Initial scriptorium structure and scholarly architecture.',
        'Continuous timeline folio support for scholars.'
      ],
      improved: [
        'Typographic proportions based on Ibn Rushd\'s Al-Mizan.'
      ]
    }
  },
  {
    id: 'rel-1.8',
    version: 'v1.8.0',
    date: '2026-07-05T00:00:00Z',
    changes: {
      added: [
        'Handwritten signature pads and vector strokes rendering.',
        'Institutional communication modules: Notices and Editor\'s Notes.'
      ],
      improved: [
        'Dynamic scroll transparency on top navigation bars.'
      ],
      fixed: [
        'Database corruption issues caused by text serialization.'
      ]
    }
  }
];

export const INITIAL_POLICIES: PolicyDocument[] = [
  {
    id: 'policy-publishing',
    type: 'Publishing',
    title: 'Publishing Policy',
    lastUpdated: '2026-07-01T12:00:00Z',
    sections: [
      {
        id: 'pub-sec-1',
        title: 'Academic Focus',
        content: 'Adjung prioritizes deliberate, structured scholarly submissions of Notes, Essays, and Articles.'
      },
      {
        id: 'pub-sec-2',
        title: 'Open Access Charter',
        content: 'All publications reside on an open, permanent, decentralized archive for long-term human preservation.'
      }
    ]
  },
  {
    id: 'policy-editorial',
    type: 'Editorial',
    title: 'Editorial Board Policy',
    lastUpdated: '2026-07-01T12:00:00Z',
    sections: [
      {
        id: 'ed-sec-1',
        title: 'Double-Blind Review',
        content: 'Every essay and article undergoes an independent double-blind review process conducted by the Board of Editors.'
      }
    ]
  },
  {
    id: 'policy-ai',
    type: 'AI',
    title: 'Artificial Intelligence Policy',
    lastUpdated: '2026-07-01T12:00:00Z',
    sections: [
      {
        id: 'ai-sec-1',
        title: 'Human Author Integrity',
        content: 'Generative AI tools must not be used to draft scholarly content. All manuscripts must represent original human reflection.'
      }
    ]
  },
  {
    id: 'policy-community',
    type: 'Community',
    title: 'Community Guidelines',
    lastUpdated: '2026-07-01T12:00:00Z',
    sections: [
      {
        id: 'comm-sec-1',
        title: 'Constructive Disagreement',
        content: 'Scholarly critique must remain strictly focused on textual arguments, maintaining deep respect and academic integrity.'
      }
    ]
  },
  {
    id: 'policy-citation',
    type: 'Citation',
    title: 'Citation Policy',
    lastUpdated: '2026-07-01T12:00:00Z',
    sections: [
      {
        id: 'cite-sec-1',
        title: 'Long-term Citation Standards',
        content: 'References must include complete titles, publisher records, and permanent DOIs or URLs to guarantee persistent links.'
      }
    ]
  }
];

export const INITIAL_LOGS: SystemLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-06-28T09:00:00Z',
    operator: 'System Daemon',
    role: 'System',
    action: 'Platform initialized with core academic schema.'
  },
  {
    id: 'log-2',
    timestamp: '2026-06-28T10:15:00Z',
    operator: 'T. Malik',
    role: 'Chief Editor',
    action: 'Configured initial scholarly publishing policies.'
  },
  {
    id: 'log-3',
    timestamp: '2026-06-29T14:30:00Z',
    operator: 'T. Malik',
    role: 'Chief Editor',
    action: 'Assigned Editor role to Amina Masri for curation support.'
  },
  {
    id: 'log-4',
    timestamp: '2026-06-30T11:22:00Z',
    operator: 'Ed. Amina',
    role: 'Editor',
    action: 'Curated frontpage featured entries list.'
  }
];

// Pre-seeded Users
export const INITIAL_USERS: User[] = [
  {
    id: 'user-tariq-malik',
    username: 'tariq.malik',
    email: 'tariq@adjung.com',
    role: 'Chief Editor',
    penName: 'T. Malik',
    signature: 'Prof. Tariq Malik',
    avatarColor: 'bg-stone-800 text-stone-100',
    bioSummary: 'Professor Emeritus of Islamic Philosophy and Comparative Literature. Chief Editor of Adjung.',
    affiliation: 'Kuala Lumpur, Malaysia'
  },
  {
    id: 'user-associate-editor',
    username: 'editor.amina',
    email: 'amina_ed@adjung.com',
    role: 'Editor',
    penName: 'Ed. Amina',
    signature: 'Amina (Editor)',
    avatarColor: 'bg-stone-700 text-stone-100',
    bioSummary: 'Associate Editor at Adjung, curating published indices and frontpage folios.',
    affiliation: 'Kuala Lumpur, Malaysia'
  },
  {
    id: 'user-zayd-ghazali',
    username: 'zayd.ghazali',
    email: 'zayd@adjung.com',
    role: 'Writer',
    penName: 'Al-Ghazali',
    signature: 'Zayd Al-Ghazali',
    avatarColor: 'bg-emerald-950 text-emerald-100',
    bioSummary: 'Scholarly writer focusing on the synthesis of medieval Arabic logic and modern typographic form.',
    affiliation: 'Cairo, Egypt'
  },
  {
    id: 'user-amina-masri',
    username: 'amina.masri',
    email: 'amina@adjung.com',
    role: 'Writer',
    penName: 'Al-Masri',
    signature: 'Amina Al-Masri',
    avatarColor: 'bg-blue-950 text-blue-100',
    bioSummary: 'Maritime historian specializing in Red Sea trading hubs and pre-modern Levantine trade routes.',
    affiliation: 'Alexandria, Egypt'
  },
  {
    id: 'user-sarah-henderson',
    username: 'sarah.henderson',
    email: 'sarah@adjung.com',
    role: 'Writer',
    penName: 'Henderson',
    signature: 'S. Henderson',
    avatarColor: 'bg-red-950 text-red-100',
    bioSummary: 'Typographer and scholar examining the intersection of modern Swiss rationalism and traditional book design.',
    affiliation: 'Zurich, Switzerland'
  }
];

export const INITIAL_IDENTITIES: IdentityProfile[] = [
  {
    identityId: 'id-user-zayd-ghazali',
    accountId: 'user-zayd-ghazali',
    username: 'zayd.ghazali',
    displayName: 'Zayd Al-Ghazali',
    penName: 'Al-Ghazali',
    biography: `Zayd Al-Ghazali is a reader and scribe of classical Islamic texts, currently investigating the formal connections between medieval Andalusian manuscript structures and Swiss typographic systems. His work frequently bridges Arabic and Jawi calligraphic disciplines with strict modular layout design. 

He holds a doctorate in Comparative Semiotics and splits his academic research between Cairo and Cordoba. Adjung serves as his central repository of unfiltered research notes, complete essays, and formal articles.`,
    publicVisibility: 'Public',
    lifeTimeline: [
      {
        id: 'bio-zayd-1',
        year: '2012',
        title: 'Academic Foundations',
        description: 'Completed Bachelor’s degree in Classical Arabic Philology with a thesis on the logical treatises of Averroes.',
        category: 'Education'
      },
      {
        id: 'bio-zayd-2',
        year: '2015',
        title: 'Andalusian Manuscripts Fellowship',
        description: 'Appointed research fellow at the University of Cordoba, documenting ink chemistry and margin conventions in 12th-century manuscripts.',
        category: 'Career'
      },
      {
        id: 'bio-zayd-3',
        year: '2019',
        title: 'Doctoral Defense',
        description: 'Successfully defended his dissertation titled "The Linear Scribe: Mathematical Order in Calligraphic Manuscripts."',
        category: 'Education'
      },
      {
        id: 'bio-zayd-4',
        year: '2022',
        title: 'Publication: The Silent Scribe',
        description: 'Published his first full monograph, examining the typographic grids of the earliest printed Arabic treatises in Europe.',
        category: 'Publication'
      },
      {
        id: 'bio-zayd-5',
        year: '2025',
        title: 'Inaugural Scholar at Adjung',
        description: 'Joined the Adjung scholarly board as a founding writer to establish a classical editorial folio.',
        category: 'Personal'
      }
    ],
    signatures: [],
    affiliation: 'Cairo, Egypt'
  },
  {
    identityId: 'id-user-amina-masri',
    accountId: 'user-amina-masri',
    username: 'amina.masri',
    displayName: 'Amina Al-Masri',
    penName: 'Al-Masri',
    biography: `Amina Al-Masri is a maritime historian and field archaeologist. For over a decade, her research has focused on the maritime trade routes of the Indian Ocean and the Red Sea during late antiquity and the early Islamic period. 

She acts as a consultant for maritime heritage preservation and teaches Economic History. Through her Adjung Folio, she hosts extensive articles complete with historical margin annotations, mapping trade registries onto modern geographic records.`,
    publicVisibility: 'Public',
    lifeTimeline: [
      {
        id: 'bio-amina-1',
        year: '2010',
        title: 'Archaeological Fieldwork at Quseir al-Qadim',
        description: 'Participated in the excavation of Roman and medieval Islamic artifacts, specializing in ceramic shard classification.',
        category: 'Career'
      },
      {
        id: 'bio-amina-2',
        year: '2014',
        title: 'Master of Arts in Historical Geography',
        description: 'Graduated from the School of Oriental and African Studies (SOAS) with distinction.',
        category: 'Education'
      },
      {
        id: 'bio-amina-3',
        year: '2018',
        title: 'The Levantine Exchange Prize',
        description: 'Received the Mediterranean Historical Society prize for her paper on spice custom tariffs in medieval Alexandria.',
        category: 'Award'
      },
      {
        id: 'bio-amina-4',
        year: '2021',
        title: 'Appointment to the Levant Institute',
        description: 'Appointed Senior Lecturer in Maritime Archaeology and Levantine History.',
        category: 'Career'
      }
    ],
    signatures: [],
    affiliation: 'Alexandria, Egypt'
  },
  {
    identityId: 'id-user-sarah-henderson',
    accountId: 'user-sarah-henderson',
    username: 'sarah.henderson',
    displayName: 'Sarah Henderson',
    penName: 'Henderson',
    biography: `Sarah Henderson is an independent typographer, editorial designer, and visual scholar based in Zurich. Her work critiques the seamlessness of modern software UI, proposing instead an "architecturally honest" and tactile approach to reading online. 

Her Adjung Folio features highly structured layout reflections and critical articles analyzing type design history and bookbinding philosophy.`,
    publicVisibility: 'Public',
    lifeTimeline: [
      {
        id: 'bio-sarah-1',
        year: '2013',
        title: 'Apprenticeship in Letterpress',
        description: 'Completed a rigorous two-year practical training program at a traditional hot-metal letterpress workshop in Leipzig.',
        category: 'Education'
      },
      {
        id: 'bio-sarah-2',
        year: '2017',
        title: 'Studio Foundation',
        description: 'Established "Studio Henderson", focusing on high-end book design and academic journal curation.',
        category: 'Career'
      },
      {
        id: 'bio-sarah-3',
        year: '2023',
        title: 'Exhibition: The Unread Page',
        description: 'Curated a widely reviewed typographic exhibition at the Zurich Museum of Design, exploring margin aesthetics.',
        category: 'Publication'
      }
    ],
    signatures: [],
    affiliation: 'Zurich, Switzerland'
  }
];

export const INITIAL_CITATIONS: Citation[] = [
  {
    id: 'cit-tufte',
    author: 'Tufte, E. R.',
    title: 'The Visual Display of Quantitative Information',
    year: 2001,
    publisher: 'Graphics Press',
    url: 'https://edwardtufte.com'
  }
];

// Pre-seeded Biographies and Profiles
export const INITIAL_PROFILES: WriterProfile[] = [
  {
    authorId: 'user-zayd-ghazali',
    heroTitle: 'On the Geometry of Reason',
    heroSubtitle: 'A collection of thoughts, essays, and notes examining classical rationalism, Andalusian aesthetics, and contemporary typography.'
  },
  {
    authorId: 'user-amina-masri',
    heroTitle: 'Maritime Pathways & Levantine Shores',
    heroSubtitle: 'Exploring the rich, forgotten commerce networks, port cities, and material cultures of the pre-modern Red Sea.'
  },
  {
    authorId: 'user-sarah-henderson',
    heroTitle: 'Form Follows Friction',
    heroSubtitle: 'Essays on Swiss functionalism, high-contrast typography, and the preservation of tactile editorial hierarchies in digital spaces.'
  }
];

// Pre-seeded Entries
export const INITIAL_ENTRIES: Entry[] = [
  // --- ZAYD AL-GHAZALI ---
  {
    id: 'entry-zayd-1',
    authorId: 'user-zayd-ghazali',
    contentType: 'Essay',
    status: 'Published',
    visibility: 'Public',
    createdDate: '2025-11-12T10:00:00Z',
    updatedDate: '2025-11-12T14:30:00Z',
    publishedDate: '2025-11-12T14:30:00Z',
    title: 'The Typographic Geometry of Classical Manuscripts',
    slug: 'typographic-geometry-classical-manuscripts',
    tags: ['Typography', 'Manuscripts', 'Andalusian', 'Geometry'],
    canonicalUrl: 'https://zayd.adjung.com/essay/typographic-geometry-classical-manuscripts',
    content: `Scholarly discussion surrounding the design of manuscripts often treats the visual layout as secondary to the written message. Yet, in classical Andalusian and Persian scriptoria, the page was treated as a mathematical canvas. The scribe began not with words, but with a system of invisible divisions.

Before a single drop of ink met the vellum, the page was folded or scored using a lead point. This established the *Mizan*—the balance of proportions. These geometric structures were not arbitrary; they adhered strictly to natural ratios, often mirroring the golden ratio or simple musical consonances.

In modern screen-based typography, we have largely abandoned this physical grid in favor of fluid, liquid layouts. While fluid grids offer responsiveness, they frequently lack the architectural grounding that stabilizes deep reading. By re-examining the scribal grid, we discover that the margin is not "empty" space; it is the structural support that gives the text block its gravity and authority.

The dialogue between Arabic script lines (the *satr*) and the surrounding annotations in the margins exemplifies a dual-layer reading experience. The primary text flows in an orderly, rhythmic horizontal progression, while the marginal comments (often written diagonally) offer a secondary, exploratory track. This invites the reader into an active, polyphonic relationship with the manuscript.`,
    footnotes: [
      'The term "Mizan" (ميزان) denotes not merely a physical scale, but the philosophical concept of cosmic and ethical balance as elaborated by Ibn Rushd.',
      'See Jan Tschichold’s "The Form of the Book" (1975) for a detailed modern analysis of classical European manuscript proportions, which share deep geometric roots with Islamic scribal arts.',
      'Diagonally oriented margin annotations, known as *Hashiyah*, were historically used to distinguish subsequent commentary from the authoritative canonical text.'
    ]
  },
  {
    id: 'entry-zayd-2',
    authorId: 'user-zayd-ghazali',
    contentType: 'Note',
    status: 'Published',
    visibility: 'Public',
    createdDate: '2026-03-15T09:12:00Z',
    updatedDate: '2026-03-15T09:12:00Z',
    publishedDate: '2026-03-15T09:15:00Z',
    title: 'On the Concept of Al-Mizan (الميزان) and Structural Restraint',
    slug: 'concept-of-al-mizan-structural-restraint',
    tags: ['Philosophy', 'Arabic Script', 'Restraint'],
    canonicalUrl: 'https://zayd.adjung.com/note/concept-of-al-mizan-structural-restraint',
    content: `When writing in classical Arabic, the calligraphy itself demands a profound physical discipline. Every letter's scale is dictated by the width of the reed pen (the *nuqtah* or dot). This is the absolute unit of measure.

The concept of *Al-Mizan* (الميزان) is beautiful because it establishes that freedom exists only *within* absolute boundaries. Without the mathematical discipline of the dot, the calligraphy descends into chaotic scribble.

<quote type="arabic">
  <arabic>في الخط العربي، الميزان هو الذي يمنح الحرف هيبته ووقاره. بدونه، يفقد النص توازنه الروحي والبصري.</arabic>
  <translation>In Arabic calligraphy, the balance is what gives the letter its prestige and dignity. Without it, the text loses its spiritual and visual equilibrium.</translation>
</quote>

In our digital editorial interfaces, we must learn this lesson. True visual luxury does not come from features, custom color pickers, or endless options. It comes from the strict, unyielding restraint of a well-defined grid and a single, flawless typeface.`
  },
  {
    id: 'entry-zayd-3',
    authorId: 'user-zayd-ghazali',
    contentType: 'Note',
    status: 'Draft',
    visibility: 'Private',
    createdDate: '2026-06-20T18:00:00Z',
    updatedDate: '2026-06-20T18:05:00Z',
    publishedDate: null,
    title: 'Draft: Reflection on Cordova Ink Recipes',
    slug: 'draft-reflection-cordova-ink-recipes',
    tags: ['History', 'Manuscripts', 'Andalusian'],
    canonicalUrl: 'https://zayd.adjung.com/note/draft-reflection-cordova-ink-recipes',
    content: `Researching the 11th-century treatise on calligraphic inks by Ibn Badis. The recipe for "soot ink" (Hibr al-Khulūd) calls for burnt flaxseed oil mixed with gum arabic and a precise volume of pomegranate rinds. 

The inclusion of pomegranate provides a rich, slightly acidic property that etches the ink deep into the vellum, preventing flaking over centuries. There is an incredible architectural honesty in using organic, structural materials to secure temporal permanence. Need to test modern adaptations of these formulas with linen vellum.`
  },

  // --- AMINA AL-MASRI ---
  {
    id: 'entry-amina-1',
    authorId: 'user-amina-masri',
    contentType: 'Article',
    status: 'Published',
    visibility: 'Public',
    createdDate: '2025-08-04T11:00:00Z',
    updatedDate: '2025-08-05T12:00:00Z',
    publishedDate: '2025-08-05T12:00:00Z',
    title: 'The Red Sea Trade Routes in Late Antiquity',
    slug: 'red-sea-trade-routes-late-antiquity',
    tags: ['History', 'Maritime', 'Trade', 'Late Antiquity'],
    canonicalUrl: 'https://amina.adjung.com/article/red-sea-trade-routes-late-antiquity',
    content: `The Red Sea, historically known to Roman cartographers as the *Sinus Arabicus*, was far more than a geographical barrier between the African continent and the Arabian peninsula. It was the vital artery of global commerce connecting the Roman Mediterranean with the wealthy merchant guilds of India and Southern Arabia.

The journey began at Alexandria, where goods were transported via the Nile to Coptos, and then traversed through the eastern desert by camel caravan to the ports of Myos Hormos and Berenike. These desert pathways were heavily guarded by Roman garrisons, securing high-value luxury commodities such as frankincense, myrrh, pepper, and silk.

At the port cities, massive dhows constructed using teak planks sewn together with coconut fiber coir awaited the seasonal monsoon winds. Sailing during the summer required absolute precision; the northern winds blew consistently south, propelling ships rapidly through the narrow channels of the Red Sea, but navigating around coral shoals was treacherous.

Upon reaching the Bab-el-Mandeb strait, ships entered the open waters of the Gulf of Aden, embarking on the trans-oceanic crossing to the Malabar coast of India. The returns on these voyages were monumental. A single Roman merchant fleet could bring back cargo worth millions of sesterces, contributing a significant percentage of the empire's custom revenues.

The archaeological excavations of the past decades have revealed the cosmopolitan nature of these ports. Shards of Indian cooking pots, Roman amphorae from Campania, and early Axumite coins sit side by side in the stratigraphic layers, offering silent testimony to an era of profound intercultural exchange.`,
    marginNotes: {
      0: 'Myos Hormos, located at modern Quseir al-Qadim, was identified in the 1970s as one of the primary Roman gatehouses to the Indian Ocean.',
      1: 'Pliny the Elder famously complained about the massive economic drain of this trade, claiming Rome lost over 50 million sesterces annually to Eastern luxuries.',
      2: 'Sewn boat construction, or "lashed-plank" building, remained the dominant maritime engineering tradition in the Western Indian Ocean for over a millennium.',
      4: 'Berenike archaeological surveys have recently uncovered the remains of a dedicated temple dedicated to Serapis, alongside Sanskrit papyrus inscriptions.'
    }
  },
  {
    id: 'entry-amina-2',
    authorId: 'user-amina-masri',
    contentType: 'Note',
    status: 'Published',
    visibility: 'Public',
    createdDate: '2026-05-10T14:22:00Z',
    updatedDate: '2026-05-10T14:22:00Z',
    publishedDate: '2026-05-10T14:30:00Z',
    title: 'The Sound of the Sewn Hull',
    slug: 'sound-of-sewn-hull',
    tags: ['History', 'Maritime', 'Acoustics'],
    canonicalUrl: 'https://amina.adjung.com/note/sound-of-sewn-hull',
    content: `There is a unique acoustic dimension to pre-modern wooden sailing vessels. Unlike Roman iron-nailed galleys, the stitched dhows of the western Indian Ocean were extraordinarily flexible. 

When sailing through heavy swells, the hull did not crash rigidly against the waves. Instead, it groaned and flexed organically, the coir fibers tightening and absorbing the structural tension. Sailors described the sound as a rhythmic, breathing dialogue between the ocean and the timber. It was a material symbiosis.`
  },

  // --- SARAH HENDERSON ---
  {
    id: 'entry-sarah-1',
    authorId: 'user-sarah-henderson',
    contentType: 'Article',
    status: 'Published',
    visibility: 'Public',
    createdDate: '2026-01-20T09:00:00Z',
    updatedDate: '2026-01-20T10:15:00Z',
    publishedDate: '2026-01-20T10:15:00Z',
    title: 'Modernism and the Swiss Grid System',
    slug: 'modernism-swiss-grid-system',
    tags: ['Typography', 'Swiss Design', 'Modernism', 'Grid'],
    canonicalUrl: 'https://sarah.adjung.com/article/modernism-swiss-grid-system',
    content: `The Swiss Grid represents the peak of rationalism in editorial design. Emerged in Zurich and Basel during the mid-20th century, designers like Emil Ruder and Josef Müller-Brockmann sought a layout language that was objective, functional, and free from ornament.

The grid was not a cage, but a structural skeleton. By dividing the page into standard columns, the designer could arrange typography, images, and negative space in a predictable yet highly dynamic hierarchy. It established a structural honesty where every element's placement was mathematically justified.

However, the digital translation of the Swiss Grid has often stripped it of its tactile elegance. On the web, grids are often treated as responsive fluid percentages that stretch and squish based on the viewport. This makes reading unpredictable and chaotic. 

<quote type="latin"><text>Typography has one plain duty before it and that is to convey information in writing. No subtlety of layout, no regional accent, no visual gimmickry should stand in the way of this supreme purpose.</text></quote>

To restore the dignity of typographic grids on screens, we must treat the screen not as an infinite fluid canvas, but as an editorial page with fixed typographic proportions, generous margins, and strict vertical rhythm. Only then can the digital page achieve the quiet authority of a physical monograph.`,
    marginNotes: {
      0: 'Müller-Brockmann’s seminal text "Grid Systems in Graphic Design" (1981) remains the definitive bible for structural page architecture.',
      1: 'The grid’s primary purpose is to establish "rhythm". Just as in musical composition, the silent intervals are as critical as the sounding notes.',
      3: 'The choice of typeface—traditionally Haas Grotesk, which became Helvetica—reinforced the ethos of absolute semantic neutrality.'
    }
  },
    {
      id: 'entry-mock-note-1',
      authorId: 'user-tariq-malik',
      contentType: 'Note',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-04-30T16:00:00.000Z',
      updatedDate: '2026-04-30T16:00:00.000Z',
      publishedDate: '2026-04-30T16:00:00.000Z',
      title: 'Note 1 - Brief Observation',
      slug: 'mock-note-1',
      tags: ['Observation', 'Thoughts'],
      canonicalUrl: 'https://tariq.Adjung.com/note/mock-note-1',
      content: `This is a brief thought recorded in the margins of daily research. Often, the most profound insights are not found in the center of the page, but in the scattered notes and marginalia that encircle the main text. Note index: 1.`
    },
    {
      id: 'entry-mock-note-2',
      authorId: 'user-amina-masri',
      contentType: 'Note',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-05-01T16:00:00.000Z',
      updatedDate: '2026-05-01T16:00:00.000Z',
      publishedDate: '2026-05-01T16:00:00.000Z',
      title: 'Note 2 - Brief Observation',
      slug: 'mock-note-2',
      tags: ['Observation', 'Thoughts'],
      canonicalUrl: 'https://author.Adjung.com/note/mock-note-2',
      content: `This is a brief thought recorded in the margins of daily research. Often, the most profound insights are not found in the center of the page, but in the scattered notes and marginalia that encircle the main text. Note index: 2.`
    },
    {
      id: 'entry-mock-note-3',
      authorId: 'user-amina-masri',
      contentType: 'Note',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-05-02T16:00:00.000Z',
      updatedDate: '2026-05-02T16:00:00.000Z',
      publishedDate: '2026-05-02T16:00:00.000Z',
      title: 'Note 3 - Brief Observation',
      slug: 'mock-note-3',
      tags: ['Observation', 'Thoughts'],
      canonicalUrl: 'https://author.Adjung.com/note/mock-note-3',
      content: `This is a brief thought recorded in the margins of daily research. Often, the most profound insights are not found in the center of the page, but in the scattered notes and marginalia that encircle the main text. Note index: 3.`
    },
    {
      id: 'entry-mock-note-4',
      authorId: 'user-zayd-ghazali',
      contentType: 'Note',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-05-03T16:00:00.000Z',
      updatedDate: '2026-05-03T16:00:00.000Z',
      publishedDate: '2026-05-03T16:00:00.000Z',
      title: 'Note 4 - Brief Observation',
      slug: 'mock-note-4',
      tags: ['Observation', 'Thoughts'],
      canonicalUrl: 'https://author.Adjung.com/note/mock-note-4',
      content: `This is a brief thought recorded in the margins of daily research. Often, the most profound insights are not found in the center of the page, but in the scattered notes and marginalia that encircle the main text. Note index: 4.`
    },
    {
      id: 'entry-mock-note-5',
      authorId: 'user-tariq-malik',
      contentType: 'Note',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-05-04T16:00:00.000Z',
      updatedDate: '2026-05-04T16:00:00.000Z',
      publishedDate: '2026-05-04T16:00:00.000Z',
      title: 'Note 5 - Brief Observation',
      slug: 'mock-note-5',
      tags: ['Observation', 'Thoughts'],
      canonicalUrl: 'https://author.Adjung.com/note/mock-note-5',
      content: `This is a brief thought recorded in the margins of daily research. Often, the most profound insights are not found in the center of the page, but in the scattered notes and marginalia that encircle the main text. Note index: 5.`
    },
    {
      id: 'entry-mock-essay-1',
      authorId: 'user-tariq-malik',
      contentType: 'Essay',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-05-31T16:00:00.000Z',
      updatedDate: '2026-05-31T16:00:00.000Z',
      publishedDate: '2026-05-31T16:00:00.000Z',
      title: 'Essay 1: On the Nature of Typography and Meaning',
      slug: 'mock-essay-1',
      tags: ['Typography', 'Meaning', 'Design'],
      canonicalUrl: 'https://tariq.Adjung.com/essay/mock-essay-1',
      content: `The exploration of typography is essentially the exploration of voice. How does a letterform speak? In this essay, we delve into the intricate relationship between the visual shape of words and their semantic weight. 

It is argued that the modernist approach stripped away the historical resonances that once anchored texts in their cultural contexts. When we restore these subtleties, the text breathes again. This essay 1 serves as a testament to the enduring power of classical typographic grids.`
    },
    {
      id: 'entry-mock-essay-2',
      authorId: 'user-amina-masri',
      contentType: 'Essay',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-06-01T16:00:00.000Z',
      updatedDate: '2026-06-01T16:00:00.000Z',
      publishedDate: '2026-06-01T16:00:00.000Z',
      title: 'Essay 2: On the Nature of Typography and Meaning',
      slug: 'mock-essay-2',
      tags: ['Typography', 'Meaning', 'Design'],
      canonicalUrl: 'https://author.Adjung.com/essay/mock-essay-2',
      content: `The exploration of typography is essentially the exploration of voice. How does a letterform speak? In this essay, we delve into the intricate relationship between the visual shape of words and their semantic weight. 

It is argued that the modernist approach stripped away the historical resonances that once anchored texts in their cultural contexts. When we restore these subtleties, the text breathes again. This essay 2 serves as a testament to the enduring power of classical typographic grids.`
    },
    {
      id: 'entry-mock-essay-3',
      authorId: 'user-tariq-malik',
      contentType: 'Essay',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-06-02T16:00:00.000Z',
      updatedDate: '2026-06-02T16:00:00.000Z',
      publishedDate: '2026-06-02T16:00:00.000Z',
      title: 'Essay 3: On the Nature of Typography and Meaning',
      slug: 'mock-essay-3',
      tags: ['Typography', 'Meaning', 'Design'],
      canonicalUrl: 'https://author.Adjung.com/essay/mock-essay-3',
      content: `The exploration of typography is essentially the exploration of voice. How does a letterform speak? In this essay, we delve into the intricate relationship between the visual shape of words and their semantic weight. 

It is argued that the modernist approach stripped away the historical resonances that once anchored texts in their cultural contexts. When we restore these subtleties, the text breathes again. This essay 3 serves as a testament to the enduring power of classical typographic grids.`
    },
    {
      id: 'entry-mock-essay-4',
      authorId: 'user-tariq-malik',
      contentType: 'Essay',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-06-03T16:00:00.000Z',
      updatedDate: '2026-06-03T16:00:00.000Z',
      publishedDate: '2026-06-03T16:00:00.000Z',
      title: 'Essay 4: On the Nature of Typography and Meaning',
      slug: 'mock-essay-4',
      tags: ['Typography', 'Meaning', 'Design'],
      canonicalUrl: 'https://author.Adjung.com/essay/mock-essay-4',
      content: `The exploration of typography is essentially the exploration of voice. How does a letterform speak? In this essay, we delve into the intricate relationship between the visual shape of words and their semantic weight. 

It is argued that the modernist approach stripped away the historical resonances that once anchored texts in their cultural contexts. When we restore these subtleties, the text breathes again. This essay 4 serves as a testament to the enduring power of classical typographic grids.`
    },
    {
      id: 'entry-mock-essay-5',
      authorId: 'user-tariq-malik',
      contentType: 'Essay',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-06-04T16:00:00.000Z',
      updatedDate: '2026-06-04T16:00:00.000Z',
      publishedDate: '2026-06-04T16:00:00.000Z',
      title: 'Essay 5: On the Nature of Typography and Meaning',
      slug: 'mock-essay-5',
      tags: ['Typography', 'Meaning', 'Design'],
      canonicalUrl: 'https://author.Adjung.com/essay/mock-essay-5',
      content: `The exploration of typography is essentially the exploration of voice. How does a letterform speak? In this essay, we delve into the intricate relationship between the visual shape of words and their semantic weight. 

It is argued that the modernist approach stripped away the historical resonances that once anchored texts in their cultural contexts. When we restore these subtleties, the text breathes again. This essay 5 serves as a testament to the enduring power of classical typographic grids.`
    },
    {
      id: 'entry-mock-article-1',
      authorId: 'user-tariq-malik',
      contentType: 'Article',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-06-30T16:00:00.000Z',
      updatedDate: '2026-06-30T16:00:00.000Z',
      publishedDate: '2026-06-30T16:00:00.000Z',
      title: 'Comprehensive Review 1: The Archival Systems of Antiquity',
      slug: 'mock-article-1',
      tags: ['Archive', 'History', 'Systems'],
      canonicalUrl: 'https://tariq.Adjung.com/article/mock-article-1',
      content: `Archives are not merely repositories of the past; they are the active mechanisms by which the future is structured. In reviewing the ancient libraries of Alexandria and Cordoba, we see a deliberate system of cataloging that mirrors the cosmic order perceived by their curators.

This article 1 examines the architectural and epistemological frameworks that supported these vast collections. We find that the classification of knowledge dictates the boundaries of thought itself. The physical layout of the scrolls influenced the intellectual pathways of the scholars who walked those halls.

As we build digital archives today, we must ask ourselves: what intellectual pathways are our databases encouraging, and which are they obscuring?`,
      footnotes: [
        'Refer to the foundational texts on archival theory for further reading.',
        'The classification systems of antiquity often prioritized theological or philosophical hierarchies over alphabetical ordering.'
      ]
    },
    {
      id: 'entry-mock-article-2',
      authorId: 'user-zayd-ghazali',
      contentType: 'Article',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-07-01T16:00:00.000Z',
      updatedDate: '2026-07-01T16:00:00.000Z',
      publishedDate: '2026-07-01T16:00:00.000Z',
      title: 'Comprehensive Review 2: The Archival Systems of Antiquity',
      slug: 'mock-article-2',
      tags: ['Archive', 'History', 'Systems'],
      canonicalUrl: 'https://author.Adjung.com/article/mock-article-2',
      content: `Archives are not merely repositories of the past; they are the active mechanisms by which the future is structured. In reviewing the ancient libraries of Alexandria and Cordoba, we see a deliberate system of cataloging that mirrors the cosmic order perceived by their curators.

This article 2 examines the architectural and epistemological frameworks that supported these vast collections. We find that the classification of knowledge dictates the boundaries of thought itself. The physical layout of the scrolls influenced the intellectual pathways of the scholars who walked those halls.

As we build digital archives today, we must ask ourselves: what intellectual pathways are our databases encouraging, and which are they obscuring?`,
      footnotes: [
        'Refer to the foundational texts on archival theory for further reading.',
        'The classification systems of antiquity often prioritized theological or philosophical hierarchies over alphabetical ordering.'
      ]
    },
    {
      id: 'entry-mock-article-3',
      authorId: 'user-tariq-malik',
      contentType: 'Article',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-07-02T16:00:00.000Z',
      updatedDate: '2026-07-02T16:00:00.000Z',
      publishedDate: '2026-07-02T16:00:00.000Z',
      title: 'Comprehensive Review 3: The Archival Systems of Antiquity',
      slug: 'mock-article-3',
      tags: ['Archive', 'History', 'Systems'],
      canonicalUrl: 'https://author.Adjung.com/article/mock-article-3',
      content: `Archives are not merely repositories of the past; they are the active mechanisms by which the future is structured. In reviewing the ancient libraries of Alexandria and Cordoba, we see a deliberate system of cataloging that mirrors the cosmic order perceived by their curators.

This article 3 examines the architectural and epistemological frameworks that supported these vast collections. We find that the classification of knowledge dictates the boundaries of thought itself. The physical layout of the scrolls influenced the intellectual pathways of the scholars who walked those halls.

As we build digital archives today, we must ask ourselves: what intellectual pathways are our databases encouraging, and which are they obscuring?`,
      footnotes: [
        'Refer to the foundational texts on archival theory for further reading.',
        'The classification systems of antiquity often prioritized theological or philosophical hierarchies over alphabetical ordering.'
      ]
    },
    {
      id: 'entry-mock-article-4',
      authorId: 'user-amina-masri',
      contentType: 'Article',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-07-03T16:00:00.000Z',
      updatedDate: '2026-07-03T16:00:00.000Z',
      publishedDate: '2026-07-03T16:00:00.000Z',
      title: 'Comprehensive Review 4: The Archival Systems of Antiquity',
      slug: 'mock-article-4',
      tags: ['Archive', 'History', 'Systems'],
      canonicalUrl: 'https://author.Adjung.com/article/mock-article-4',
      content: `Archives are not merely repositories of the past; they are the active mechanisms by which the future is structured. In reviewing the ancient libraries of Alexandria and Cordoba, we see a deliberate system of cataloging that mirrors the cosmic order perceived by their curators.

This article 4 examines the architectural and epistemological frameworks that supported these vast collections. We find that the classification of knowledge dictates the boundaries of thought itself. The physical layout of the scrolls influenced the intellectual pathways of the scholars who walked those halls.

As we build digital archives today, we must ask ourselves: what intellectual pathways are our databases encouraging, and which are they obscuring?`,
      footnotes: [
        'Refer to the foundational texts on archival theory for further reading.',
        'The classification systems of antiquity often prioritized theological or philosophical hierarchies over alphabetical ordering.'
      ]
    },
    {
      id: 'entry-mock-article-5',
      authorId: 'user-amina-masri',
      contentType: 'Article',
      status: 'Published',
      visibility: 'Public',
      createdDate: '2026-07-04T16:00:00.000Z',
      updatedDate: '2026-07-04T16:00:00.000Z',
      publishedDate: '2026-07-04T16:00:00.000Z',
      title: 'Comprehensive Review 5: The Archival Systems of Antiquity',
      slug: 'mock-article-5',
      tags: ['Archive', 'History', 'Systems'],
      canonicalUrl: 'https://author.Adjung.com/article/mock-article-5',
      content: `Archives are not merely repositories of the past; they are the active mechanisms by which the future is structured. In reviewing the ancient libraries of Alexandria and Cordoba, we see a deliberate system of cataloging that mirrors the cosmic order perceived by their curators.

This article 5 examines the architectural and epistemological frameworks that supported these vast collections. We find that the classification of knowledge dictates the boundaries of thought itself. The physical layout of the scrolls influenced the intellectual pathways of the scholars who walked those halls.

As we build digital archives today, we must ask ourselves: what intellectual pathways are our databases encouraging, and which are they obscuring?`,
      footnotes: [
        'Refer to the foundational texts on archival theory for further reading.',
        'The classification systems of antiquity often prioritized theological or philosophical hierarchies over alphabetical ordering.'
      ]
    },{
    id: 'entry-mock-notice-1',
    authorId: 'user-tariq-malik', // Chief Editor
    contentType: 'Notice',
    status: 'Published',
    visibility: 'Public',
    createdDate: new Date(2026, 6, 1).toISOString(),
    updatedDate: new Date(2026, 6, 1).toISOString(),
    publishedDate: new Date(2026, 6, 1).toISOString(),
    title: 'Scheduled Platform Maintenance',
    slug: 'scheduled-platform-maintenance-july',
    tags: ['Announcement', 'Maintenance'],
    canonicalUrl: 'https://Adjung.com/notice/scheduled-platform-maintenance-july',
    content: `Please be advised that the Adjung scholarly archive will undergo scheduled platform maintenance on **July 15, 2026**. During this time, the editorium and reading interfaces may be temporarily unavailable.

We anticipate the downtime to last no longer than two hours. We thank you for your patience as we upgrade our core archival infrastructure.`,
    isInstitutional: true,
    isPinned: true,
    priority: 'High'
  },{
    id: 'entry-mock-editorial-1',
    authorId: 'user-tariq-malik', // Chief Editor
    contentType: 'Editor\'s Note',
    status: 'Published',
    visibility: 'Public',
    createdDate: new Date(2026, 0, 1).toISOString(),
    updatedDate: new Date(2026, 0, 1).toISOString(),
    publishedDate: new Date(2026, 0, 1).toISOString(),
    title: 'On the Future of Adjung',
    slug: 'on-the-future-of-adjung',
    tags: ['Philosophy', 'Direction', 'Editorial'],
    canonicalUrl: 'https://Adjung.com/editorial/on-the-future-of-adjung',
    content: `As we move into a new era of digital scholarship, the Adjung Editorial Board reflects on our founding principles. The digital age promised democratization of knowledge, yet often delivered fragmentation. 

In this note, we reaffirm our commitment to structured, deliberate, and deeply integrated academic publishing. The future of Adjung is not merely about hosting texts; it is about preserving the relationships between texts—the citations, the margins, the silent dialogues that bridge centuries of thought.

We invite our writers to continue pushing the boundaries of what a digital manuscript can be.`,
    excerpt: 'As we move into a new era of digital scholarship, the Adjung Editorial Board reflects on our founding principles. The digital age promised democratization of knowledge, yet often delivered fragmentation.',
    isInstitutional: true,
    isPinned: true,
    editorialCategory: 'Philosophy'
  },
  {
    id: 'entry-manifesto',
    authorId: null,
    publisher: 'Adjung Editorial Board',
    contentType: 'Editor\'s Note',
    status: 'Published',
    visibility: 'Public',
    createdDate: new Date(2026, 5, 12).toISOString(),
    updatedDate: new Date(2026, 5, 12).toISOString(),
    publishedDate: new Date(2026, 5, 12).toISOString(),
    title: 'Why Adjung Exists',
    slug: 'why-adjung-exists',
    tags: ['Manifesto', 'Philosophy', 'Core'],
    canonicalUrl: 'https://adjung.com/editorial/why-adjung-exists',
    excerpt: 'Knowledge was never meant to compete for attention.',
    content: `The internet has made it possible for [ideas](gloss:thought) to travel farther than at any other time in history. Yet many of the most thoughtful contributions are quietly buried beneath an endless stream[^fn-1] of new content,[^mn-1] before they have the opportunity to be read, questioned, and understood.

We created Adjung as a quiet home for [knowledge](gloss:wisdom)[^fn-2] where anyone, regardless of profession or background, can write, preserve, and discover work that deserves to remain meaningful for generations,[^mn-2] rather than only for today's conversations.

Here, ideas are valued by their [substance](gloss:essence),[^fn-3] not by popularity, appearance,[^mn-3] or algorithms. There are no like buttons to chase, no notifications to distract—only the quiet clarity of reasoned thought.

To preserve the depth of scholarship, Adjung integrates three distinct dimensions of notation:[^mn-4] [interlinear notes](gloss:translation) for instant semantic clarity, margin notes for context-rich commentary, and footnotes for source citations.[^fn-4] Every publication is treated as a lasting contribution to humanity's shared record of knowledge.`,
    isInstitutional: true,
    isPinned: true,
    footnotesData: [
      {
        id: 'fn-1',
        label: 'Attention Economy',
        content: 'An endless stream continually replaces what came before, regardless of its long-term value.'
      },
      {
        id: 'fn-2',
        label: 'Preservation',
        content: 'Preservation means ensuring that knowledge remains accessible, citable, and discoverable over time.'
      },
      {
        id: 'fn-3',
        label: 'Editorial Principle',
        content: 'Ideas are evaluated by their intellectual contribution rather than popularity or visibility.'
      },
      {
        id: 'fn-4',
        label: 'authoritative sources',
        content: 'Authoritative citations are preserved at the base of each document to anchor its arguments in established research.'
      }
    ],
    marginNotesData: {
      'mn-1': "EDITORIAL NOTE\nEndless feeds reward immediacy. Knowledge requires continuity.",
      'mn-2': "PRESERVATION\nPreservation begins when a work is expected to outlive its author.",
      'mn-3': "EDITORIAL PRINCIPLE\nReaders should encounter ideas before personalities.",
      'mn-4': "THREE-LAYER NOTE SYSTEM\nBy separating translation, active dialogue, and structured citations, we maintain absolute textual purity."
    }
  },
  {
    id: 'entry-canonical-note',
    authorId: 'user-zayd-ghazali',
    contentType: 'Note',
    status: 'Published',
    visibility: 'Public',
    createdDate: '2026-07-07T12:00:00Z',
    updatedDate: '2026-07-07T12:00:00Z',
    publishedDate: '2026-07-07T12:00:00Z',
    title: 'Canonical Note on Classical Scholarship',
    slug: 'canonical-note-classical-scholarship',
    tags: ['Canonical', 'Note', 'Standard'],
    canonicalUrl: 'https://zayd.adjung.com/note/canonical-note-classical-scholarship',
    content: 'This is the Canonical Note. Note publications are short, casual observations designed without massive titles or abstract summaries. They rely on hand-written letterforms like Caveat to deliver an intimate reading experience. By utilizing [direct](gloss:clear) notation, they offer immediate clarity.'
  },
  {
    id: 'entry-canonical-note-ar',
    authorId: 'user-zayd-ghazali',
    contentType: 'Note',
    status: 'Published',
    visibility: 'Public',
    createdDate: '2026-07-07T12:00:00Z',
    updatedDate: '2026-07-07T12:00:00Z',
    publishedDate: '2026-07-07T12:00:00Z',
    title: 'Canonical Arabic Note (الترميز العربي)',
    slug: 'canonical-note-ar',
    tags: ['Canonical', 'Arabic', 'Note'],
    canonicalUrl: 'https://zayd.adjung.com/note/canonical-note-ar',
    content: 'هذه هي الملاحظة المعيارية المكتوبة بخط الرقعة العربي التقليدي. تُعرض الملاحظات دائمًا بدون عناوين ضخمة، لتوفير تجربة قراءة حميمية ومريحة للباحث الكلاسيكي.'
  },
  {
    id: 'entry-canonical-essay',
    authorId: 'user-zayd-ghazali',
    contentType: 'Essay',
    status: 'Published',
    visibility: 'Public',
    createdDate: '2026-07-07T12:00:00Z',
    updatedDate: '2026-07-07T12:00:00Z',
    publishedDate: '2026-07-07T12:00:00Z',
    title: 'Canonical Essay: The Art of Traditional Academic Typography',
    slug: 'canonical-essay-academic-typography',
    tags: ['Canonical', 'Essay', 'Academic'],
    canonicalUrl: 'https://zayd.adjung.com/essay/canonical-essay-academic-typography',
    excerpt: 'This is the official Canonical Essay, designed as the baseline standard for academic book publishing in Adjung. It utilizes formal margins, traditional footnotes at the bottom, and drop-caps.',
    content: 'Traditional scholarship thrives on the physical geometry of text blocks. The layout of an essay must respect the focus of the reader, anchoring complex source citations at the base of the page.[^fn-1] By integrating [classical](gloss:traditional) proportions, we ensure a deep reading environment.\n\nFurthermore, the presentation of structured ideas requires a clear hierarchy of headings. The footnotes registry serves as the cross-referencing anchor, ensuring absolute textual authority.[^fn-2]',
    footnotesData: [
      {
        id: 'fn-1',
        label: 'Scribal Restraint',
        content: 'Citing the classical dot-based measures of Arabic calligraphers.'
      },
      {
        id: 'fn-2',
        label: 'Footnotes Standard',
        content: 'Footnotes reside at the base of the page, acting as the scholarly anchor.'
      }
    ]
  },
  {
    id: 'entry-canonical-article',
    authorId: 'user-zayd-ghazali',
    contentType: 'Article',
    status: 'Published',
    visibility: 'Public',
    createdDate: '2026-07-07T12:00:00Z',
    updatedDate: '2026-07-07T12:00:00Z',
    publishedDate: '2026-07-07T12:00:00Z',
    title: 'Canonical Article: The Digital Press Layout Model',
    slug: 'canonical-article-digital-press-model',
    tags: ['Canonical', 'Article', 'Press'],
    canonicalUrl: 'https://zayd.adjung.com/article/canonical-article-digital-press-model',
    excerpt: 'This is the official Canonical Article, representing the wide-canvas digital twin of modern journalism. It supports structured multi-columns, featured images, and active margin notes.',
    content: 'Digital publications require active commentary paths. Unlike essays, articles make use of the left or right margins to present immediate annotations next to the paragraphs they reference.[^mn-1] This split-screen layout keeps the primary and secondary readings visually aligned.\n\nIn addition, articles support high-impact media features such as large titles, featured headers, and custom matrices to outline systemic dimensions.[^mn-2]',
    marginNotesData: {
      'mn-1': 'MARGIN COMMENTARY\nAnnotations are kept inline with text to enrich the digital reading layer.',
      'mn-2': 'MODERN MEDIA\nArticles are wide-canvas layouts with large typography and media integrations.'
    }
  }
];

export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  academicAffiliation: 'Consortium of Independent Editorial Scholars',
  editorialPolicy: BRAND.tagline,
  accentColor: '#802334',
  allowSelfRegistration: false,
  editorialSelectionIds: ['entry-zayd-1', 'entry-amina-1', 'entry-sarah-1'],
  featuredScholarId: 'user-zayd-ghazali',
  featuredEntryId: 'entry-zayd-1',
  featuredEssayIds: [],
  featuredNoteIds: [],
  announcementBanner: 'Welcome to the Adjung scholarly archive. The independent digital press.',
  enableArabicAccent: true,
  layoutDensity: 'Standard',
  allowedSignatureFonts: ['Pinyon Script', 'Alex Brush', 'Great Vibes', 'Parisienne', 'Allura', 'Herr Von Muellerhoff'],
  inTheNewsText: `Desk: Astronomy
Title: NASA Reviews Long-Term Options for the Hubble Space Telescope
Brief: NASA is evaluating whether the Hubble Space Telescope should continue operating into the 2030s, preserving one of astronomy's most influential observatories.
Source: Nature
URL: https://www.nature.com/articles/d41586-026-02000-x

---

Desk: Libraries
Title: Library of Congress Announces 2026 National Book Festival
Brief: More than eighty authors will participate in the annual festival, highlighting the enduring role of libraries in public scholarship and reading culture.
Source: Library of Congress
URL: https://newsroom.loc.gov/news/2026-library-of-congress-national-book-festival-features-more-than-80-authors-and-new-programming-to/s/7237e3a3-6b60-437a-bd1b-f15dfc680119

---

Desk: Islamic Affairs
Title: Historic Quranic Manuscripts Undergo Advanced Digital Conservation
Brief: Researchers at the Islamic Heritage Foundation have begun a comprehensive high-resolution digital scanning initiative to preserve early Kufic Quran fragments.
Source: Islamic Heritage Foundation
URL: https://www.islamicheritage.org/news/digital-conservation-early-kufic

---

Desk: Archaeology
Title: Pre-Modern Trading Vessels Discovered in the Red Sea
Brief: Marine archaeologists have located shipwreck remains dating back to the late antiquity period, containing custom customs documents and trade jars.
Source: Journal of Maritime Archaeology
URL: https://www.journalmaritimearch.org/articles/red-sea-discovery`,
  inTheNewsGoogleDocUrl: '',
  worldClockHolidaysText: '',
  worldClockHolidaysGoogleDocUrl: '',
  researchFindingsText: `Finding: Social media usage is linked to decreased attention spans and cognitive fatigue.
Source: Journal of Media Psychology, 2025

---

Finding: Deep reading builds cognitive stamina and improves critical thinking skills.
Source: Stanford Research Centre, 2026

---

Finding: Regular digital disconnection restores neural pathways associated with empathy and reflection.
Source: MIT Technology Review, 2024`,
  researchFindingsGoogleDocUrl: '',
  rolePermissions: {
    'Chief Editor': {
      viewIndex: true,
      viewDirectory: true,
      curateFrontpage: true,
      inviteWriters: true,
      moderateReports: true,
      editOthersContent: false,
      manageSettings: true,
      manageRbac: true,
      manageLogs: true,
      createNotice: true,
      editNotice: true,
      publishNotice: true,
      archiveNotice: true,
      deleteNotice: true,
      createEditorNote: true,
      editEditorNote: true,
      publishEditorNote: true,
      archiveEditorNote: true,
      deleteEditorNote: true
    },
    'Editor': {
      viewIndex: true,
      viewDirectory: true,
      curateFrontpage: true,
      inviteWriters: false,
      moderateReports: true,
      editOthersContent: false,
      manageSettings: false,
      manageRbac: false,
      manageLogs: false,
      createNotice: true,
      editNotice: true,
      publishNotice: true,
      archiveNotice: true,
      deleteNotice: true,
      createEditorNote: true,
      editEditorNote: true,
      publishEditorNote: true,
      archiveEditorNote: true,
      deleteEditorNote: true
    },
    'Writer': {
      viewIndex: false,
      viewDirectory: false,
      curateFrontpage: false,
      inviteWriters: false,
      moderateReports: false,
      editOthersContent: false,
      manageSettings: false,
      manageRbac: false,
      manageLogs: false,
      createNotice: false,
      editNotice: false,
      publishNotice: false,
      archiveNotice: false,
      deleteNotice: false,
      createEditorNote: false,
      editEditorNote: false,
      publishEditorNote: false,
      archiveEditorNote: false,
      deleteEditorNote: false
    },
    'Visitor': {
      viewIndex: false,
      viewDirectory: false,
      curateFrontpage: false,
      inviteWriters: false,
      moderateReports: false,
      editOthersContent: false,
      manageSettings: false,
      manageRbac: false,
      manageLogs: false,
      createNotice: false,
      editNotice: false,
      publishNotice: false,
      archiveNotice: false,
      deleteNotice: false,
      createEditorNote: false,
      editEditorNote: false,
      publishEditorNote: false,
      archiveEditorNote: false,
      deleteEditorNote: false
    }
  }
};

class AdjungDb {
  private users: User[] = [];
  private profiles: WriterProfile[] = [];
  private identities: IdentityProfile[] = [];
  private citations: Citation[] = [];
  private entries: Entry[] = [];
  private systemSettings: SystemSettings = INITIAL_SYSTEM_SETTINGS;
  private logs: SystemLog[] = [];
  private releaseLogs: ReleaseLog[] = [];
  private policies: PolicyDocument[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedUsers = localStorage.getItem('adjung_users');
      const storedProfiles = localStorage.getItem('adjung_profiles');
      const storedIdentities = localStorage.getItem('adjung_identities');
      const storedCitations = localStorage.getItem('adjung_citations');
      const storedEntries = localStorage.getItem('adjung_entries');
      const storedSettings = localStorage.getItem('adjung_settings');

      if (storedUsers) {
        let loadedUsers: User[] = JSON.parse(storedUsers);
        INITIAL_USERS.forEach(initUser => {
          if (!loadedUsers.some(u => u.id === initUser.id)) {
            loadedUsers.push({ ...initUser });
          }
        });

        this.users = loadedUsers;
        this.saveUsersToStorage();
      } else {
        this.users = INITIAL_USERS;
        this.saveUsersToStorage();
      }

      if (storedProfiles) {
        this.profiles = JSON.parse(storedProfiles);
      } else {
        this.profiles = INITIAL_PROFILES;
        this.saveProfilesToStorage();
      }

      if (storedIdentities) {
        this.identities = JSON.parse(storedIdentities);
      } else {
        this.identities = INITIAL_IDENTITIES;
        this.saveIdentitiesToStorage();
      }

      if (storedCitations) {
        this.citations = JSON.parse(storedCitations);
      } else {
        this.citations = INITIAL_CITATIONS;
        this.saveCitationsToStorage();
      }

      if (storedEntries) {
        let loadedEntries = JSON.parse(storedEntries);
        // Force merge INITIAL_ENTRIES if the mock entries are missing from local storage
        if (loadedEntries.length < 17) {
          loadedEntries = [...INITIAL_ENTRIES];
        } else {
          // Always ensure new canonical entries are imported
          let modified = false;
          INITIAL_ENTRIES.forEach((initialEntry: any) => {
            if (initialEntry.id.startsWith('entry-canonical-')) {
              const exists = loadedEntries.some((le: any) => le.id === initialEntry.id);
              if (!exists) {
                loadedEntries.push(initialEntry);
                modified = true;
              }
            }
          });
          if (modified) {
            localStorage.setItem('adjung_entries', JSON.stringify(loadedEntries));
          }
        }
        // Auto-detect and purge corrupted entries (content with ****X**** between every character)
        const isCorrupted = (text: string) => {
          if (!text) return false;
          // Corrupted content has pattern: ****X**** repeated - check for many consecutive ****
          const corruptionPattern = /\*{4}[a-zA-Z]\*{4}/;
          return corruptionPattern.test(text);
        };
        this.entries = loadedEntries.filter((e: any) => {
          if (isCorrupted(e.content) || isCorrupted(e.title)) {
            console.warn(`[Adjung DB] Auto-removed corrupted entry: ${e.id} ("${e.title}")`);
            return false;
          }
          return true;
        });
        // Normalize entries for new metadata compatibility
        this.entries.forEach(e => {
          if (e.excerpt === undefined) e.excerpt = '';
          if (e.featuredImage === undefined) e.featuredImage = '';
          if (e.revisions === undefined) e.revisions = [];
          if (e.citations === undefined) e.citations = [];
          if (e.referenceSortOrder === undefined) e.referenceSortOrder = 'alphabetical';
          e.revisions.forEach((r: any) => {
            if (r.citations === undefined) r.citations = [];
            if (r.referenceSortOrder === undefined) r.referenceSortOrder = 'alphabetical';
          });
        });
        // Always force update entry-manifesto content on initialization to get updated inline badges
        const manifestoIndex = this.entries.findIndex(e => e.id === 'entry-manifesto');
        const updatedManifesto = INITIAL_ENTRIES.find(e => e.id === 'entry-manifesto');
        if (updatedManifesto) {
          if (manifestoIndex > -1) {
            this.entries[manifestoIndex] = {
              ...this.entries[manifestoIndex],
              content: updatedManifesto.content,
              footnotesData: updatedManifesto.footnotesData,
              marginNotesData: updatedManifesto.marginNotesData
            };
          } else {
            this.entries.push(updatedManifesto);
          }
        }
        this.saveEntriesToStorage();
      } else {
        this.entries = [...INITIAL_ENTRIES];
        this.saveEntriesToStorage();
      }

      // Populate publicationClass and authorId on all entries
      this.entries.forEach((e: any) => {
        if (e.id === 'entry-mock-notice-1' || e.contentType === 'Notice') {
          e.publicationClass = 'Institutional';
          e.authorId = null;
          e.publisher = 'Adjung Editorial Board';
          e.isInstitutional = true;
        } else if (e.id === 'entry-mock-editorial-1' || e.id === 'entry-manifesto' || e.contentType === "Editor's Note") {
          e.publicationClass = 'Institutional';
          e.authorId = null;
          e.publisher = 'Adjung Editorial Board';
          e.isInstitutional = true;
        } else {
          e.publicationClass = e.publicationClass || 'Scholarly';
        }
      });
      this.saveEntriesToStorage();

      if (storedSettings) {
        this.systemSettings = JSON.parse(storedSettings);
        if (
          !this.systemSettings.editorialSelectionIds ||
          this.systemSettings.editorialSelectionIds.length === 0 ||
          this.systemSettings.editorialSelectionIds.includes('entry-1')
        ) {
          this.systemSettings.editorialSelectionIds = [...INITIAL_SYSTEM_SETTINGS.editorialSelectionIds];
        }
        if (!this.systemSettings.allowedSignatureFonts || this.systemSettings.allowedSignatureFonts.length === 0 || this.systemSettings.allowedSignatureFonts.includes('Outfit') || this.systemSettings.allowedSignatureFonts.includes('Sacramento')) {
          this.systemSettings.allowedSignatureFonts = [...(INITIAL_SYSTEM_SETTINGS.allowedSignatureFonts || [])];
        }
        if (this.systemSettings.editorialPolicy === 'Adjung maintains a text-first, classical layout discipline inspired by early European university journals and Arabic calligraphic treatises.') {
          this.systemSettings.editorialPolicy = BRAND.tagline;
        }

        if (!this.systemSettings.featuredEntryId) {
          this.systemSettings.featuredEntryId = INITIAL_SYSTEM_SETTINGS.featuredEntryId;
        }
        if (!this.systemSettings.featuredScholarId) {
          this.systemSettings.featuredScholarId = INITIAL_SYSTEM_SETTINGS.featuredScholarId;
        }
        if (!this.systemSettings.inTheNewsText) {
          this.systemSettings.inTheNewsText = INITIAL_SYSTEM_SETTINGS.inTheNewsText;
        }
        if (!this.systemSettings.featuredEssayIds) {
          this.systemSettings.featuredEssayIds = [];
        }
        if (!this.systemSettings.featuredNoteIds) {
          this.systemSettings.featuredNoteIds = [];
        }

        // Robustly ensure all roles and permission keys are populated
        if (!this.systemSettings.rolePermissions) {
          this.systemSettings.rolePermissions = { ...INITIAL_SYSTEM_SETTINGS.rolePermissions };
        } else {
          const roles: UserRole[] = ['Chief Editor', 'Editor', 'Writer', 'Visitor'];
          roles.forEach(role => {
            if (!this.systemSettings.rolePermissions[role]) {
              this.systemSettings.rolePermissions[role] = { ...INITIAL_SYSTEM_SETTINGS.rolePermissions[role] };
            } else {
              this.systemSettings.rolePermissions[role] = {
                ...INITIAL_SYSTEM_SETTINGS.rolePermissions[role],
                ...this.systemSettings.rolePermissions[role]
              };
            }
          });
        }
        this.saveSettingsToStorage();
      } else {
        this.systemSettings = INITIAL_SYSTEM_SETTINGS;
        this.saveSettingsToStorage();
      }

      const storedLogs = localStorage.getItem('adjung_logs');
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      } else {
        this.logs = INITIAL_LOGS;
        this.saveLogsToStorage();
      }

      const storedReleaseLogs = localStorage.getItem('adjung_release_logs');
      if (storedReleaseLogs) {
        this.releaseLogs = JSON.parse(storedReleaseLogs);
      } else {
        this.releaseLogs = INITIAL_RELEASE_LOGS;
        this.saveReleaseLogsToStorage();
      }

      const storedPolicies = localStorage.getItem('adjung_policies');
      if (storedPolicies) {
        this.policies = JSON.parse(storedPolicies);
      } else {
        this.policies = INITIAL_POLICIES;
        this.savePoliciesToStorage();
      }
    } catch (e) {
      console.error('Error loading Adjung DB, fallback to initial data', e);
      this.users = INITIAL_USERS;
      this.profiles = INITIAL_PROFILES;
      this.identities = INITIAL_IDENTITIES;
      this.citations = INITIAL_CITATIONS;
      this.entries = [...INITIAL_ENTRIES];
      this.entries.forEach((e: any) => {
        if (e.id === 'entry-mock-notice-1' || e.contentType === 'Notice') {
          e.publicationClass = 'Institutional';
          e.authorId = null;
          e.publisher = 'Adjung Editorial Board';
          e.isInstitutional = true;
        } else if (e.id === 'entry-mock-editorial-1' || e.contentType === "Editor's Note") {
          e.publicationClass = 'Institutional';
          e.authorId = null;
          e.publisher = 'Adjung Editorial Board';
          e.isInstitutional = true;
        } else {
          e.publicationClass = e.publicationClass || 'Scholarly';
        }
      });
      this.systemSettings = INITIAL_SYSTEM_SETTINGS;
      this.logs = INITIAL_LOGS;
      this.releaseLogs = INITIAL_RELEASE_LOGS;
      this.policies = INITIAL_POLICIES;
    }
  }

  // Save methods
  public saveUsersToStorage() {
    localStorage.setItem('adjung_users', JSON.stringify(this.users));
  }
  private saveProfilesToStorage() {
    localStorage.setItem('adjung_profiles', JSON.stringify(this.profiles));
  }
  private saveIdentitiesToStorage() {
    localStorage.setItem('adjung_identities', JSON.stringify(this.identities));
  }
  private saveCitationsToStorage() {
    localStorage.setItem('adjung_citations', JSON.stringify(this.citations));
  }
  private saveEntriesToStorage() {
    localStorage.setItem('adjung_entries', JSON.stringify(this.entries));
  }
  private saveSettingsToStorage() {
    localStorage.setItem('adjung_settings', JSON.stringify(this.systemSettings));
  }
  private saveLogsToStorage() {
    localStorage.setItem('adjung_logs', JSON.stringify(this.logs));
  }
  private saveReleaseLogsToStorage() {
    localStorage.setItem('adjung_release_logs', JSON.stringify(this.releaseLogs));
  }
  private savePoliciesToStorage() {
    localStorage.setItem('adjung_policies', JSON.stringify(this.policies));
  }

  // --- RELEASE LOGS API ---
  getReleaseLogs(): ReleaseLog[] {
    return this.releaseLogs;
  }
  saveReleaseLog(log: ReleaseLog) {
    const idx = this.releaseLogs.findIndex(l => l.id === log.id);
    if (idx >= 0) {
      this.releaseLogs[idx] = log;
    } else {
      this.releaseLogs.push(log);
    }
    this.saveReleaseLogsToStorage();
  }
  deleteReleaseLog(id: string) {
    this.releaseLogs = this.releaseLogs.filter(l => l.id !== id);
    this.saveReleaseLogsToStorage();
  }

  // --- POLICIES API ---
  getPolicies(): PolicyDocument[] {
    return this.policies;
  }
  savePolicy(policy: PolicyDocument) {
    const idx = this.policies.findIndex(p => p.id === policy.id);
    policy.lastUpdated = new Date().toISOString();
    if (idx >= 0) {
      this.policies[idx] = policy;
    } else {
      this.policies.push(policy);
    }
    this.savePoliciesToStorage();
  }

  // Public APIs
  getUsers(): User[] {
    return this.users;
  }
  getUserById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getUserByUsername(username: string): User | undefined {
    return this.users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase());
  }

  updateUser(updatedUser: User) {
    this.users = this.users.map(u => u.id === updatedUser.id ? updatedUser : u);
    this.saveUsersToStorage();
  }

  createUser(user: User) {
    this.users.push(user);
    this.saveUsersToStorage();

    // Create associated empty profile
    const newProfile: WriterProfile = {
      authorId: user.id,
      heroTitle: `${user.penName}’s Folio`,
      heroSubtitle: 'A collection of writings and academic journals.'
    };
    this.profiles.push(newProfile);
    this.saveProfilesToStorage();
    
    // Create associated identity
    const newIdentity: IdentityProfile = {
      identityId: `id-${user.id}`,
      accountId: user.id,
      username: user.username,
      displayName: user.penName,
      penName: user.penName,
      biography: `Biography for ${user.penName}. Academic scholar on Adjung.`,
      publicVisibility: 'Public',
      lifeTimeline: [],
      signatures: []
    };
    this.identities.push(newIdentity);
    this.saveIdentitiesToStorage();
  }

  deleteUser(id: string) {
    this.users = this.users.filter(u => u.id !== id);
    this.profiles = this.profiles.filter(p => p.authorId !== id);
    this.identities = this.identities.filter(i => i.accountId !== id);
    this.entries = this.entries.filter(e => e.authorId !== id);
    this.saveUsersToStorage();
    this.saveProfilesToStorage();
    this.saveIdentitiesToStorage();
    this.saveEntriesToStorage();
  }

  getProfiles(): WriterProfile[] {
    return this.profiles;
  }

  getProfileByAuthorId(authorId: string): WriterProfile {
    const found = this.profiles.find(p => p.authorId === authorId);
    if (found) return found;

    // Fallback if none exists
    const user = this.getUserById(authorId);
    const newProfile: WriterProfile = {
      authorId,
      heroTitle: user ? `${user.penName}’s Folio` : 'Academic Folio',
      heroSubtitle: 'A collection of writings and scholarly notes.'
    };
    this.profiles.push(newProfile);
    this.saveProfilesToStorage();
    return newProfile;
  }

  updateProfile(profile: WriterProfile) {
    this.profiles = this.profiles.map(p => p.authorId === profile.authorId ? profile : p);
    this.saveProfilesToStorage();
  }

  // --- IDENTITY STUDIO API ---
  getIdentities(): IdentityProfile[] {
    return this.identities;
  }
  
  getIdentityById(id: string): IdentityProfile | undefined {
    return this.identities.find(i => i.identityId === id);
  }
  
  getIdentityByAccountId(accountId: string): IdentityProfile | undefined {
    let identity = this.identities.find(i => i.accountId === accountId);
    if (!identity) {
      const user = this.getUserById(accountId);
      if (user) {
        identity = {
          identityId: `id-${accountId}`,
          accountId: accountId,
          username: user.username,
          displayName: user.penName || user.username,
          penName: user.penName || user.username,
          biography: user.bioSummary || '',
          publicVisibility: 'Public',
          lifeTimeline: [],
          signatures: user.signature ? [{
            id: `sig-${Date.now()}`,
            label: user.signature,
            type: 'typed',
            typedText: user.signature,
            fontFamily: 'Outfit',
            status: 'Default',
            strokes: [],
            createdAt: new Date().toISOString()
          }] : []
        };
        this.identities.push(identity);
        this.saveIdentitiesToStorage();
      }
    }
    return identity;
  }
  
  updateIdentity(identity: IdentityProfile) {
    const exists = this.identities.some(i => i.identityId === identity.identityId);
    if (exists) {
      this.identities = this.identities.map(i => i.identityId === identity.identityId ? identity : i);
    } else {
      this.identities.push(identity);
    }
    this.saveIdentitiesToStorage();
  }
  
  saveSignature(accountId: string, signature: DigitalSignature) {
    const identity = this.getIdentityByAccountId(accountId);
    if (!identity) return;
    
    // Set all other signatures to non-default if this is default
    let updatedSignatures = identity.signatures || [];
    if (signature.status === 'Default') {
      updatedSignatures = updatedSignatures.map(s => ({ ...s, status: s.status === 'Default' ? 'Archived' : s.status }));
    }
    
    const existingIndex = updatedSignatures.findIndex(s => s.id === signature.id);
    if (existingIndex >= 0) {
      updatedSignatures[existingIndex] = signature;
    } else {
      updatedSignatures.push(signature);
    }
    
    this.updateIdentity({ ...identity, signatures: updatedSignatures });
  }

  // --- CITATION LIBRARY API ---
  getCitations(): Citation[] {
    return this.citations;
  }

  getCitationById(id: string): Citation | undefined {
    return this.citations.find(c => c.id === id);
  }

  checkDuplicateCitation(citation: Omit<Citation, 'id'>): Citation | undefined {
    return this.citations.find(c => 
      c.title.toLowerCase() === citation.title.toLowerCase() && 
      c.author.toLowerCase() === citation.author.toLowerCase() && 
      c.year === citation.year
    );
  }

  createCitation(citation: Omit<Citation, 'id'>): Citation {
    const newCitation = { ...citation, id: `cit-${Date.now()}` };
    this.citations.push(newCitation);
    this.saveCitationsToStorage();
    return newCitation;
  }

  updateCitation(id: string, updates: Partial<Citation>) {
    this.citations = this.citations.map(c => c.id === id ? { ...c, ...updates } : c);
    this.saveCitationsToStorage();
  }

  getEntries(): Entry[] {
    return this.entries;
  }

  getEntriesByAuthor(authorId: string): Entry[] {
    return this.entries.filter(e => e.authorId === authorId);
  }

  getPublishedEntriesByAuthor(authorId: string): Entry[] {
    return this.entries.filter(e => e.authorId === authorId && e.status === 'Published' && e.visibility === 'Public');
  }

  getEntryById(id: string): Entry | undefined {
    return this.entries.find(e => e.id === id);
  }

  saveEntry(entry: Entry) {
    const index = this.entries.findIndex(e => e.id === entry.id);
    entry.updatedDate = new Date().toISOString();
    if (entry.contentType === 'Notice' || entry.contentType === "Editor's Note") {
      entry.publicationClass = 'Institutional';
      entry.isInstitutional = true;
      if (entry.status === 'Published') {
        entry.authorId = null;
        entry.publisher = 'Adjung Editorial Board';
      }
    }
    if (index >= 0) {
      this.entries[index] = entry;
    } else {
      entry.createdDate = new Date().toISOString();
      this.entries.push(entry);
    }
    this.saveEntriesToStorage();
  }

  deleteEntry(id: string) {
    this.entries = this.entries.filter(e => e.id !== id);
    this.saveEntriesToStorage();
  }

  getSystemSettings(): SystemSettings {
    return this.systemSettings;
  }

  updateSystemSettings(settings: SystemSettings) {
    this.systemSettings = settings;
    this.saveSettingsToStorage();
  }

  getLogs(): SystemLog[] {
    return this.logs;
  }

  addLog(action: string, operator: string, role: string) {
    const newLog: SystemLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      operator,
      role,
      action
    };
    this.logs = [newLog, ...this.logs];
    this.saveLogsToStorage();
  }

  setUsers(users: User[]) {
    this.users = users;
    this.saveUsersToStorage();
  }

  setProfiles(profiles: WriterProfile[]) {
    this.profiles = profiles;
    this.saveProfilesToStorage();
  }

  setEntries(entries: Entry[]) {
    this.entries = entries;
    this.saveEntriesToStorage();
  }

  setSystemSettings(settings: SystemSettings) {
    this.systemSettings = settings;
    this.saveSettingsToStorage();
  }

  setIdentities(identities: IdentityProfile[]) {
    this.identities = identities;
    this.saveIdentitiesToStorage();
  }

  resetToDefaults() {
    this.users = INITIAL_USERS;
    this.profiles = INITIAL_PROFILES;
    this.identities = INITIAL_IDENTITIES;
    this.citations = INITIAL_CITATIONS;
    this.entries = INITIAL_ENTRIES;
    this.systemSettings = INITIAL_SYSTEM_SETTINGS;
    this.logs = INITIAL_LOGS;
    this.releaseLogs = INITIAL_RELEASE_LOGS;
    this.policies = INITIAL_POLICIES;
    this.saveUsersToStorage();
    this.saveProfilesToStorage();
    this.saveIdentitiesToStorage();
    this.saveCitationsToStorage();
    this.saveEntriesToStorage();
    this.saveSettingsToStorage();
    this.saveLogsToStorage();
    this.saveReleaseLogsToStorage();
    this.savePoliciesToStorage();
  }
}

export const db = new AdjungDb();
