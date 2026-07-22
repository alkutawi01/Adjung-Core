// Length limits are NOT checked here -- a title and its brief share one fixed space budget per
// card (see core/editorial/ContentBudget.js's validateContentBudget), so checking either field
// against a flat number in isolation is wrong regardless of what that number is. This class only
// checks for the one thing that's universally invalid no matter the slot: empty content.
class EditorialValidator {
  static validate(title, summary) {
    if (!title || !title.trim()) {
      return { isValid: false, reason: 'Tajuk kandungan kosong.' };
    }
    if (!summary || !summary.trim()) {
      return { isValid: false, reason: 'Ringkasan kandungan kosong.' };
    }

    return { isValid: true, cleanTitle: title.trim(), cleanSummary: summary.trim() };
  }
}

export default EditorialValidator;
