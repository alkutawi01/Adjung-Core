class PresentationComposer {
  /**
   * Resolves a URL to a registered publisher in the database.
   * If not registered, falls back to hostname formatting.
   */
  static async resolvePublisher(db, url) {
    if (!url || url === '#' || !url.startsWith('http')) {
      return {
        publisherId: 'unknown',
        publisherName: 'Umum',
        isOfficial: 0,
        authorityScore: 50,
        defaultGlyphProfile: 'general',
        defaultDesk: 'general'
      };
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Query publishers from SQLite
      const publishers = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM publisher_directory", [], (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      // Match hostname against domainPattern patterns
      const matched = publishers.find(p => hostname.includes(p.domainPattern.toLowerCase()));

      if (matched) {
        return {
          publisherId: matched.id,
          publisherName: matched.publisherName,
          isOfficial: matched.isOfficial,
          authorityScore: matched.authorityScore,
          defaultGlyphProfile: matched.defaultGlyphProfile || matched.defaultDesk || 'general',
          defaultDesk: matched.defaultDesk || 'general'
        };
      }

      // Fallback formatting for clean hostname display
      const cleanHost = hostname.replace('www.', '');
      const parts = cleanHost.split('.');
      const rawName = parts[0] || 'Umum';
      const capitalized = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      return {
        publisherId: rawName,
        publisherName: capitalized,
        isOfficial: 0,
        authorityScore: 50,
        defaultGlyphProfile: 'general',
        defaultDesk: 'general'
      };
    } catch (e) {
      console.error('PresentationComposer resolvePublisher error:', e);
      return {
        publisherId: 'unknown',
        publisherName: 'Umum',
        isOfficial: 0,
        authorityScore: 50,
        defaultGlyphProfile: 'general',
        defaultDesk: 'general'
      };
    }
  }

  /**
   * Composes a Render Token based on the slot template type (Hero, Standard, Compact)
   * and maps the attributes according to SPEC-023 metadata rules.
   */
  static async composeToken(db, slot, editorialObj, approvedRevision, avList) {
    const allowedTypes = (slot.allowedContentTypes || 'Brief').split(',');
    const outTypeRaw = allowedTypes[0].trim().toLowerCase(); // brief, book, event, etc.

    // Map template types to layoutVariant
    let layoutVariant = 'standard-news';
    if (slot.slotIndex === 0) {
      layoutVariant = 'hero-news';
    } else if (slot.slotIndex === 4 || slot.slotIndex === 5 || slot.slotIndex >= 31 && slot.slotIndex <= 32 || outTypeRaw === 'sponsor') {
      layoutVariant = 'compact-news';
    }

    // Extract attributes list
    const getAttr = (key) => {
      const match = avList.find(av => av.attributeId === key);
      return match ? match.valueText : '';
    };

    const rawUrl = getAttr('url') || '#';
    const category = getAttr('desk') || editorialObj.categoryId || 'umum';
    const cleanCategory = category.toLowerCase().trim();

    // 1. Resolve Publisher details
    const customSource = getAttr('source');
    const publisherMeta = await this.resolvePublisher(db, rawUrl);
    if (customSource && customSource.trim() !== '') {
      publisherMeta.publisherName = customSource.trim();
    }

    // 2. Map presentation and glyph profiles based on category
    const presentationProfile = cleanCategory;
    const glyphProfile = cleanCategory;

    // 3. Construct raw token
    const token = {
      layoutVariant,
      presentationProfile,
      glyphProfile,
      publicationType: outTypeRaw, // 'brief' -> 'news', etc. Wait, map to standard strings
      desk: cleanCategory,
      publisherId: publisherMeta.publisherId,
      publisherName: publisherMeta.publisherName,
      publishedAt: approvedRevision.createdAt || new Date().toISOString(),
      isOfficial: publisherMeta.isOfficial === 1,
      sourceUrl: rawUrl
    };

    // Apply mapping normalization for types
    if (token.publicationType === 'brief') token.publicationType = 'news';
    else if (token.publicationType === 'essay') token.publicationType = 'essay';
    else if (token.publicationType === 'book') token.publicationType = 'book';
    else if (token.publicationType === 'event') token.publicationType = 'event';

    // 4. Apply Metadata Composition Rules Matrix (SPEC-023 Section C)
    if (layoutVariant === 'compact-news') {
      // Compact (KOMPAK) cards now render desk/source/url/date and a brief line (2026-07-21
      // update), so the old SPEC-023 rule stripping this metadata down to bare title would
      // silently discard real, accurate desk/source/url data and fall back to "UMUM"/"Umum"/"#"
      // placeholders -- same shape as standard-news, plus brief.
      return {
        layoutVariant,
        presentationProfile,
        glyphProfile,
        publicationType: token.publicationType,
        desk: token.desk,
        publisherId: token.publisherId,
        publisherName: token.publisherName,
        publishedAt: token.publishedAt,
        isOfficial: token.isOfficial,
        sourceUrl: token.sourceUrl,
        title: approvedRevision.title || '',
        brief: approvedRevision.summary || ''
      };
    } else if (layoutVariant === 'standard-news') {
      // Standard card has all except: summary/brief (handled in markup), glyph sometimes depending on style
      return {
        layoutVariant,
        presentationProfile,
        glyphProfile,
        publicationType: token.publicationType,
        desk: token.desk,
        publisherId: token.publisherId,
        publisherName: token.publisherName,
        publishedAt: token.publishedAt,
        isOfficial: token.isOfficial,
        sourceUrl: token.sourceUrl,
        title: approvedRevision.title || '',
        brief: approvedRevision.summary || ''
      };
    }

    // Hero news returns the full set including summary/brief
    return {
      ...token,
      title: approvedRevision.title || '',
      brief: approvedRevision.summary || ''
    };
  }
}

export default PresentationComposer;
