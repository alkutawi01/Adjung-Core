class EditorialValidator {
  static validate(title, summary, maxSummaryLength = 380) {
    if (!title || !title.trim()) {
      return { isValid: false, reason: 'Tajuk berita kosong.' };
    }
    if (!summary || !summary.trim()) {
      return { isValid: false, reason: 'Ringkasan berita kosong.' };
    }

    const cleanTitle = title.trim();
    const cleanSummary = summary.trim();

    if (cleanTitle.length > 115) {
      return { isValid: false, reason: `Panjang tajuk melebihi 115 aksara (Semasa: ${cleanTitle.length}).` };
    }

    if (cleanSummary.length > maxSummaryLength) {
      return { isValid: false, reason: `Panjang ringkasan melebihi ${maxSummaryLength} aksara (Semasa: ${cleanSummary.length}).` };
    }

    return { isValid: true, cleanTitle, cleanSummary };
  }
}

export default EditorialValidator;
